import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  claim: vi.fn(),
  resolveEntrantTarget: vi.fn(),
}));

vi.mock("~/infrastructure/ai", () => ({ ai: { complete: vi.fn() } }));
vi.mock("~/modules/models/application/resolve", () => ({ getAuxiliaryModel: vi.fn() }));
vi.mock("~/modules/tasks/application/TaskService", () => ({ TaskService: vi.fn() }));
vi.mock("~/modules/usage/application/usageManager", () => ({ UsageManager: vi.fn() }));
vi.mock("../../infrastructure/BenchmarkResultStore", () => ({
  BenchmarkResultStore: { forEnv: vi.fn() },
}));
vi.mock("../invoke", () => ({ invokeEntrant: vi.fn() }));
vi.mock("../entrants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../entrants")>()),
  resolveEntrantTarget: mocks.resolveEntrantTarget,
}));

import type { IEnv } from "~/types";

import { executeBenchmarkRun } from "../runner";

const env = {} as IEnv;

function repositories(run: Record<string, unknown>) {
  return {
    benchmarkRuns: {
      get: vi.fn().mockResolvedValue(run),
      update: mocks.update,
      claim: mocks.claim,
    },
    users: { getUserById: vi.fn() },
  } as never;
}

beforeEach(() => {
  mocks.update.mockReset();
  mocks.claim.mockReset();
  mocks.resolveEntrantTarget.mockReset();
});

describe("executeBenchmarkRun", () => {
  it("cancels an official run queued for a provider outside the approved labs", async () => {
    const result = await executeBenchmarkRun(
      env,
      repositories({
        id: "run-1",
        benchmark_id: "countdown",
        version: 1,
        scope: "official",
        status: "queued",
        owner_user_id: null,
        entrant: {
          kind: "model",
          modelId: "anthropic/claude-opus-5.5",
          provider: "openrouter",
          name: "Claude Opus 5.5",
        },
      }),
      { runId: "run-1", offset: 0 },
    );

    expect(result.status).toBe("success");
    expect(mocks.update).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "cancelled" }),
    );
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.resolveEntrantTarget).not.toHaveBeenCalled();
  });
});
