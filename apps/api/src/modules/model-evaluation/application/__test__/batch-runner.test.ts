import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import type { ModelRouteRecord } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import type { IEnv } from "~/types";

import type {
  ModelEvalRunRecord,
  ModelEvalSuiteRecord,
} from "../../infrastructure/ModelEvalRepository";

const provider = vi.hoisted(() => ({ submit: vi.fn(), poll: vi.fn() }));
const enqueueTask = vi.hoisted(() => vi.fn());

vi.mock("~/infrastructure/providers/capabilities/batch", () => ({
  getBatchProvider: () => provider,
}));
vi.mock("~/modules/tasks/application/TaskService", () => ({
  TaskService: class {
    enqueueTask = enqueueTask;
  },
}));
vi.mock("~/modules/models/application/resolve", () => ({
  getAuxiliaryModel: async () => ({ model: "judge", provider: "workers-ai" }),
}));
vi.mock("~/modules/model-registry/application/decisions", () => ({
  openRouteReview: vi.fn(),
  syncVersionReviews: vi.fn(),
}));

import { BATCH_MAX_POLL_ATTEMPTS, executeBatchedEvalRun } from "../batch-runner";

function bucket() {
  const objects = new Map<string, string>();

  return {
    objects,
    binding: {
      get: vi.fn(async (key: string) =>
        objects.has(key) ? { json: async () => JSON.parse(objects.get(key) ?? "null") } : null,
      ),
      put: vi.fn(async (key: string, value: string) => {
        objects.set(key, value);
      }),
    } as unknown as R2Bucket,
  };
}

const suite = {
  id: "suite-1",
  name: "Capitals",
  workspace_id: "ws-1",
  project_id: null,
  system_prompt: "Answer in one word.",
  grader_ids: ["grader-1"],
  cases: [
    { id: "france", input: "Capital of France?", expected: "Paris" },
    { id: "spain", input: "Capital of Spain?", expected: "Madrid" },
  ],
  replay_sample_size: 10,
} as unknown as ModelEvalSuiteRecord;
const run = {
  id: "run-1",
  trigger: "manual",
  version_id: "v-1",
  cases_total: 2,
} as unknown as ModelEvalRunRecord;
const route = {
  id: "route-1",
  provider: "openai",
  provider_model_id: "gpt-test",
  deployment_id: null,
  workspace_id: "ws-1",
} as unknown as ModelRouteRecord;

function repositories() {
  return {
    tasks: {},
    modelEvals: { updateRun: vi.fn(), updateRunScores: vi.fn(), listRuns: vi.fn(async () => []) },
    modelGraders: {
      listByIds: vi.fn(async () => [{ metric: "correct", config: { kind: "contains" } }]),
    },
    modelGovernance: { addEvidence: vi.fn() },
  } as unknown as RepositoryManager & {
    modelEvals: { updateRun: ReturnType<typeof vi.fn>; updateRunScores: ReturnType<typeof vi.fn> };
  };
}

describe("executeBatchedEvalRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits every case once, keeps the handle and schedules a poll", async () => {
    const storage = bucket();
    const repos = repositories();

    provider.submit.mockResolvedValue({ batchId: "batch-1" });

    await executeBatchedEvalRun({} as IEnv, repos, {
      run,
      suite,
      route,
      bucket: storage.binding,
      pollAttempt: 0,
    });

    expect(provider.submit).toHaveBeenCalledWith([
      {
        id: "case_0",
        model: "gpt-test",
        prompt: "Capital of France?",
        system: "Answer in one word.",
        maxTokens: 2048,
      },
      expect.objectContaining({ id: "case_1", prompt: "Capital of Spain?" }),
    ]);
    expect(storage.objects.get("model-registry/eval-runs/run-1.batch.json")).toContain("batch-1");
    expect(enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_data: expect.objectContaining({ batch: true, pollAttempt: 1 }),
      }),
    );
  });

  it("grades completed outputs, keeps failures in the results and skips latency", async () => {
    const storage = bucket();
    const repos = repositories();

    storage.objects.set(
      "model-registry/eval-runs/run-1.batch.json",
      JSON.stringify({ provider: "openai", batchId: "batch-1" }),
    );
    provider.poll.mockResolvedValue({
      status: "completed",
      results: [
        { id: "case_0", text: "Paris" },
        { id: "case_1", error: "rate limited" },
      ],
    });

    await executeBatchedEvalRun({} as IEnv, repos, {
      run,
      suite,
      route,
      bucket: storage.binding,
      pollAttempt: 3,
    });

    const results = JSON.parse(storage.objects.get("model-registry/eval-runs/run-1.json") ?? "[]");

    expect(results).toEqual([
      expect.objectContaining({ caseId: "france", scores: { correct: 1 } }),
      expect.objectContaining({ caseId: "spain", scores: { correct: 0 }, error: "rate limited" }),
    ]);
    expect(repos.modelEvals.updateRunScores).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ correct: expect.objectContaining({ mean: 0.5, n: 2 }) }),
      null,
    );
  });

  it("fails the run once the batch window has passed", async () => {
    const storage = bucket();
    const repos = repositories();

    storage.objects.set(
      "model-registry/eval-runs/run-1.batch.json",
      JSON.stringify({ provider: "openai", batchId: "batch-1" }),
    );
    provider.poll.mockResolvedValue({ status: "in_progress" });

    await executeBatchedEvalRun({} as IEnv, repos, {
      run,
      suite,
      route,
      bucket: storage.binding,
      pollAttempt: BATCH_MAX_POLL_ATTEMPTS,
    });

    expect(repos.modelEvals.updateRun).toHaveBeenCalledWith("run-1", {
      status: "failed",
      failure_reason: "The batch did not finish within its 24-hour window",
    });
    expect(enqueueTask).not.toHaveBeenCalled();
  });
});
