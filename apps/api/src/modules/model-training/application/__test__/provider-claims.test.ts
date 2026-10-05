import {
  createHost,
  hostManifest,
  trainerManifest,
  type Host,
  type HostDeploymentState,
  type ModelHandle,
  type Trainer,
  type TrainingJobState,
} from "@ngriffin_uk/polychat-ai-model-providers";
import { PENDING } from "@ngriffin_uk/polychat-ai-workflows";
import { modelVersionAttributesSchema, trainingSpecSchema } from "@ngriffin_uk/polychat-schemas";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { accrueDeploymentCost } from "~/modules/model-governance/application/spend";
import { isRevoked, loadRegistryScope } from "~/modules/model-registry/application/scope";
import { ArtefactStore } from "~/modules/model-registry/infrastructure/ArtefactStore";
import { applyHostState, hostFor } from "~/modules/model-serving/application/invocation";
import { syncDeployment } from "~/modules/model-serving/application/sync";

import { testModelDeployment } from "../../../../../test/fixtures/model-platform";
import { databaseTestEnvironment } from "../../../../../test/helpers/environment";
import { initialiseModelPlatformDatabase } from "../../../../../test/helpers/model-platform-database";
import { syncTrainingRun } from "../sync";
import { trainerFor } from "../trainer-context";

vi.mock("../trainer-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../trainer-context")>()),
  trainerFor: vi.fn(),
}));
vi.mock("~/modules/model-serving/application/invocation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/modules/model-serving/application/invocation")>()),
  hostFor: vi.fn(),
}));
const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
  r2Buckets: ["ASSETS"],
});
let context: ServiceContext;
let versionId: string;
let runId: string;
let deploymentId: string;
const trainingState: TrainingJobState = {
  providerJobId: "job",
  status: "running",
  metrics: [],
  checkpoints: [],
  output: null,
  costUsd: 1,
  failureReason: null,
  startedAt: null,
  completedAt: null,
};
const hostState: HostDeploymentState = {
  providerRef: "resource",
  status: "running",
  region: "eu",
  readyReplicas: 1,
  hourlyUsd: 1,
  failureReason: null,
};
const trainer: Trainer = {
  manifest: trainerManifest("huggingface", "huggingface-jobs"),
  submit: vi.fn(),
  status: vi.fn(),
  cancel: vi.fn(),
};
const host: Host = {
  manifest: hostManifest("huggingface", "huggingface-endpoints"),
  create: vi.fn(),
  status: vi.fn(),
  scale: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  delete: vi.fn(),
  invoke: vi.fn(),
  list: vi.fn(),
};

beforeAll(async () => {
  const database = await runtime.getD1Database("DB");

  await initialiseModelPlatformDatabase(database);
  const env = databaseTestEnvironment(database);

  env.PRIVATE_ASSETS_BUCKET = await runtime.getR2Bucket("ASSETS");
  context = createServiceContext({ env });
  await context.repositories.modelGovernance.savePolicy({
    workspaceId: "workspace",
    projectId: null,
    rules: [],
    hash: "allow",
    enforcement: "enforced",
    updatedBy: 1,
  });
  const asset = await context.repositories.modelAssets.createAsset({
    workspaceId: "workspace",
    kind: "model",
    source: "huggingface",
    sourceRef: "org/base",
    displayName: "Base",
    createdBy: 1,
  });
  const version = await context.repositories.modelAssets.createVersion({
    workspaceId: "workspace",
    assetId: asset.id,
    revision: "a".repeat(40),
    status: "ready",
    attributes: modelVersionAttributesSchema.parse({
      licence: "apache-2.0",
      formats: [],
      parameterCount: null,
      gated: false,
      remoteCode: false,
      pipelineTag: null,
      libraryName: null,
      tags: [],
      baseModels: [],
      totalBytes: 0,
      trainingComputeFlops: null,
      architecture: null,
      location: null,
    }),
    files: [],
    createdBy: 1,
  });

  versionId = version.id;
});
afterAll(() => runtime.dispose());
beforeEach(async () => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.spyOn(context.repositories.audit, "createRecord").mockResolvedValue(undefined);
  vi.spyOn(ArtefactStore.prototype, "presign").mockResolvedValue("https://example.com/report");
  vi.mocked(trainerFor).mockResolvedValue(trainer);
  vi.mocked(trainer.submit).mockResolvedValue(trainingState);
  vi.mocked(trainer.status).mockResolvedValue(trainingState);
  vi.mocked(trainer.cancel).mockResolvedValue(undefined);
  vi.mocked(host.create).mockResolvedValue(hostState);
  vi.mocked(host.status).mockResolvedValue(hostState);
  vi.mocked(host.pause).mockResolvedValue({ ...hostState, status: "paused" });
  vi.mocked(host.delete).mockResolvedValue(undefined);
  const model: ModelHandle = {
    versionId,
    name: "Base",
    kind: "model",
    weights: { kind: "hub", repo: "org/base", revision: "a".repeat(40) },
    architecture: null,
    parameterCount: null,
    remoteCode: false,
    base: null,
  };

  vi.mocked(hostFor).mockImplementation(async (_repositories, deployment) => ({
    host,
    model,
    adapters: [],
    hosted: deployment.provider_ref
      ? {
          providerRef: deployment.provider_ref,
          spec: deployment.spec,
          model,
          adapters: [],
          desired: deployment.desired_state === "paused" ? "paused" : "running",
        }
      : null,
  }));
  const run = await context.repositories.modelTraining.create({
    workspaceId: "workspace",
    projectId: null,
    spec: trainingSpecSchema.parse({
      method: "quantise",
      baseVersionId: versionId,
      target: { provider: "huggingface", target: "huggingface-jobs" },
      outputName: "trained-model",
    }),
    specHash: "hash",
    provider: "huggingface",
    trainer: "huggingface-jobs",
    outputRepository: "org/output",
    datasetVersionIds: [],
    estimate: { usd: 10, low: 8, high: 12, basis: "estimate", gpuHours: 1, tokens: null },
    compute: null,
    createdBy: 1,
  });

  runId = run.id;
  const deployment = await context.repositories.modelDeployments.create({
    workspaceId: "workspace",
    projectId: null,
    name: run.id,
    versionId,
    spec: { ...testModelDeployment.spec, versionId },
    specHash: "hash",
    provider: "huggingface",
    host: "endpoints",
    jurisdiction: "eu",
    weightsVerified: true,
    createdBy: 1,
  });

  deploymentId = deployment.id;
});

it("submits a training job only once across concurrent sync tasks", async () => {
  await Promise.all([
    syncTrainingRun(context.env, context.repositories, runId),
    syncTrainingRun(context.env, context.repositories, runId),
  ]);
  expect(trainer.submit).toHaveBeenCalledOnce();
  expect((await context.repositories.modelTraining.getById(runId))?.provider_job_id).toBe("job");
});

it("creates a deployment only once across concurrent sync tasks", async () => {
  await Promise.all([
    syncDeployment(context.repositories, deploymentId),
    syncDeployment(context.repositories, deploymentId),
  ]);
  expect(host.create).toHaveBeenCalledOnce();
  expect((await context.repositories.modelDeployments.getById(deploymentId))?.provider_ref).toBe(
    "resource",
  );
});

it("cancels a job requested while provider submission is in flight and records its cost", async () => {
  vi.mocked(trainer.submit).mockImplementationOnce(async () => {
    await context.repositories.modelTraining.requestCancellation("workspace", runId);

    return trainingState;
  });
  vi.mocked(trainer.status).mockResolvedValue({
    ...trainingState,
    status: "cancelled",
    costUsd: 2,
  });
  await expect(syncTrainingRun(context.env, context.repositories, runId)).resolves.toMatchObject({
    status: "success",
  });
  expect(trainer.cancel).toHaveBeenCalledWith("job");
  expect(await context.repositories.modelTraining.getById(runId)).toMatchObject({
    status: "cancelled",
    provider_job_id: "job",
    cost_usd: 2,
  });
});

it("honours a pause requested while deployment creation is in flight", async () => {
  vi.mocked(host.create).mockImplementationOnce(async () => {
    await context.repositories.modelDeployments.update(deploymentId, { desired_state: "paused" });

    return hostState;
  });
  expect(await syncDeployment(context.repositories, deploymentId)).toBe(PENDING);
  await syncDeployment(context.repositories, deploymentId);
  expect(host.create).toHaveBeenCalledOnce();
  expect(host.pause).toHaveBeenCalledOnce();
  expect(await context.repositories.modelDeployments.getById(deploymentId)).toMatchObject({
    status: "paused",
    desired_state: "paused",
  });
});

it("registers an output returned immediately by submission", async () => {
  vi.mocked(trainer.submit).mockResolvedValue({
    ...trainingState,
    status: "completed",
    output: { kind: "provider", provider: "huggingface", ref: "completed-model" },
    costUsd: 3,
  });
  await expect(syncTrainingRun(context.env, context.repositories, runId)).resolves.toMatchObject({
    status: "success",
    message: "Completed",
  });
  expect(await context.repositories.modelTraining.getById(runId)).toMatchObject({
    status: "completed",
    output_version_id: expect.any(String),
    cost_usd: 3,
  });
});

it("does not submit after cancellation won the claim or after an uncertain provider failure", async () => {
  await context.repositories.modelTraining.requestCancellation("workspace", runId);
  await syncTrainingRun(context.env, context.repositories, runId);
  expect(trainer.submit).not.toHaveBeenCalled();
  vi.mocked(host.create).mockRejectedValueOnce(new Error("Connection lost after create"));
  await syncDeployment(context.repositories, deploymentId);
  await syncDeployment(context.repositories, deploymentId);
  expect(host.create).toHaveBeenCalledOnce();
});

it("does not charge twice when deployment syncs settle the same billing interval", async () => {
  await context.repositories.modelDeployments.update(deploymentId, {
    status: "running",
    hourly_usd: 2,
    billed_until: "2026-09-27T00:00:00Z",
  });
  const deployment = await context.repositories.modelDeployments.getById(deploymentId);

  if (!deployment) {
    throw new Error("Expected the deployment");
  }

  const now = new Date("2026-09-27T01:00:00Z");

  await Promise.all([
    accrueDeploymentCost(context.repositories, deployment, true, now),
    accrueDeploymentCost(context.repositories, deployment, true, now),
  ]);
  await accrueDeploymentCost(
    context.repositories,
    deployment,
    true,
    new Date("2026-09-27T02:00:00Z"),
  );
  expect(await context.repositories.modelSpend.sumSubjectCost("deployment", deploymentId)).toBe(2);
  expect((await context.repositories.modelDeployments.getById(deploymentId))?.billed_until).toBe(
    now.toISOString(),
  );
});

it("replaces a training cost atomically under concurrent polls", async () => {
  const input = {
    workspaceId: "workspace",
    projectId: null,
    subjectType: "training_run" as const,
    subjectId: runId,
    provider: "huggingface" as const,
    basis: "reported" as const,
    periodStart: "2026-09-27T00:00:00Z",
    periodEnd: "2026-09-27T01:00:00Z",
  };

  await Promise.all([
    context.repositories.modelSpend.replaceSubjectCost({ ...input, usd: 2 }),
    context.repositories.modelSpend.replaceSubjectCost({ ...input, usd: 3 }),
  ]);
  const entries = (
    await context.repositories.modelSpend.listCosts("workspace", input.periodStart)
  ).filter((entry) => entry.subject_id === runId);

  expect(entries).toHaveLength(1);
  expect([2, 3]).toContain(entries[0]?.usd);
});

it("reports an interrupted creation without submitting another job", async () => {
  await context.repositories.modelTraining.claimSubmission(runId);
  const database = await runtime.getD1Database("DB");

  await database
    .prepare(
      "UPDATE model_training_run SET submission_started_at = '2020-01-01T00:00:00Z' WHERE id = ?",
    )
    .bind(runId)
    .run();
  await expect(syncTrainingRun(context.env, context.repositories, runId)).resolves.toMatchObject({
    status: "error",
    message: expect.stringContaining("reconcile"),
  });
  await syncTrainingRun(context.env, context.repositories, runId);
  expect(trainer.submit).not.toHaveBeenCalled();
  expect((await context.repositories.modelTraining.getById(runId))?.status).toBe("failed");
});

it("settles an already cancelled provider job without sending cancellation again", async () => {
  await context.repositories.modelTraining.claimSubmission(runId);
  await context.repositories.modelTraining.recordProviderState(runId, {
    provider_job_id: "job",
    status: "running",
  });
  await context.repositories.modelTraining.requestCancellation("workspace", runId);
  vi.mocked(trainer.status).mockResolvedValue({ ...trainingState, status: "cancelled" });
  vi.mocked(trainer.cancel).mockRejectedValue(new Error("This job is already terminal"));

  await expect(syncTrainingRun(context.env, context.repositories, runId)).resolves.toMatchObject({
    status: "success",
    message: "Cancelled",
  });
  expect(trainer.cancel).not.toHaveBeenCalled();
});

it("waits for provisioning and confirms dedicated provider deletion", async () => {
  await context.repositories.modelDeployments.update(deploymentId, {
    desired_state: "deleted",
    provider_ref: "operation",
    status: "deleting",
  });
  vi.mocked(host.status)
    .mockResolvedValueOnce({ ...hostState, providerRef: "operation", status: "provisioning" })
    .mockResolvedValueOnce({ ...hostState, providerRef: "endpoint" })
    .mockResolvedValueOnce({ ...hostState, providerRef: "endpoint", status: "deleting" })
    .mockResolvedValue({ ...hostState, providerRef: "endpoint", status: "deleted" });

  expect(await syncDeployment(context.repositories, deploymentId)).toBe(PENDING);
  expect(host.delete).not.toHaveBeenCalled();
  expect(await syncDeployment(context.repositories, deploymentId)).toBe(PENDING);
  expect(host.delete).toHaveBeenCalledWith(
    expect.objectContaining({ providerRef: "endpoint", desired: "deleted" }),
  );
  expect((await context.repositories.modelDeployments.getById(deploymentId))?.status).toBe(
    "deleting",
  );
  await expect(syncDeployment(context.repositories, deploymentId)).resolves.toMatchObject({
    status: "success",
  });
  expect((await context.repositories.modelDeployments.getById(deploymentId))?.status).toBe(
    "deleted",
  );
});

it("claims the paid continuation after an upload and rejects stale or repeated claims", async () => {
  await context.repositories.modelDeployments.update(deploymentId, {
    provider_ref: "upload|job|model",
  });
  const deployment = await context.repositories.modelDeployments.getById(deploymentId);

  if (!deployment) {
    throw new Error("Missing deployment");
  }

  const fetcher = vi.fn<typeof fetch>(async (_url, init) =>
    Response.json(
      init?.method === "POST" ? { id: "endpoint", state: "STARTED" } : { status: "completed" },
    ),
  );
  const adapter = createHost("together", "together", {
    credentials: { secrets: { apiKey: "test" }, config: {} },
    hub: null,
    fetcher,
    claimProvisioningContinuation: async () => {
      if (
        !(await context.repositories.modelDeployments.claimProvisioningContinuation(
          deploymentId,
          "upload|job|model",
        ))
      ) {
        throw new Error("Already claimed");
      }
    },
  });
  const hosted = {
    providerRef: "upload|job|model",
    spec: deployment.spec,
    model: {
      versionId,
      name: "Base",
      kind: "model" as const,
      weights: { kind: "hub" as const, repo: "org/base", revision: "a".repeat(40) },
      remoteCode: false,
      parameterCount: null,
      architecture: null,
      base: null,
    },
    adapters: [],
    desired: "running" as const,
  };
  const outcomes = await Promise.allSettled([adapter.status(hosted), adapter.status(hosted)]);

  expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  await expect(adapter.status(hosted)).rejects.toThrow("Already claimed");
  const completed = outcomes.find((outcome) => outcome.status === "fulfilled");

  if (!completed || completed.status !== "fulfilled") {
    throw new Error("Missing completion");
  }

  await applyHostState(context.repositories, deployment, completed.value);
  await applyHostState(context.repositories, deployment, {
    ...hostState,
    providerRef: "upload|job|model",
    status: "provisioning",
  });
  expect((await context.repositories.modelDeployments.getById(deploymentId))?.provider_ref).toBe(
    "endpoint|endpoint|model",
  );
  expect(
    await context.repositories.modelDeployments.claimProvisioningContinuation(
      deploymentId,
      "upload|job|model",
    ),
  ).toBe(false);
  await expect(adapter.status({ ...hosted, desired: "deleted" })).resolves.toMatchObject({
    status: "deleted",
  });
  await expect(adapter.status({ ...hosted, desired: "paused" })).resolves.toMatchObject({
    status: "paused",
  });
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
});

it("keeps a completed output withdrawn when an input was revoked while training", async () => {
  vi.mocked(trainer.submit).mockImplementationOnce(async () => {
    await context.repositories.modelGovernance.createDecision({
      workspaceId: "workspace",
      projectId: null,
      versionId,
      routeId: null,
      state: "revoked",
      verdict: { effect: "allow", matches: [], policyHashes: [] },
      evidenceIds: [],
      isException: false,
      note: "Withdraw source",
      requestedBy: 1,
    });

    return {
      ...trainingState,
      status: "completed",
      output: { kind: "provider", provider: "huggingface", ref: "withdrawn-output" },
    };
  });
  await expect(syncTrainingRun(context.env, context.repositories, runId)).resolves.toMatchObject({
    status: "success",
  });
  const run = await context.repositories.modelTraining.getById(runId);

  expect(run?.output_version_id).toBeTruthy();
  const scope = await loadRegistryScope(context.repositories, "workspace", null);

  expect(isRevoked(scope, run?.output_version_id ?? "")).toBe(true);
});
