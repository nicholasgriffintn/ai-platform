import { createFakeRuntime } from "@ngriffin_uk/polychat-ai-billing/testing";
import { ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { describe, expect, it, vi } from "vitest";

import type { Repositories } from "~/infrastructure/database/repositories";
import { createUsageRuntime } from "~/modules/usage/application/runtime";
import type { IEnv } from "~/types";

import { reserveSandboxRun } from "../usage";

vi.mock("~/modules/usage/application/runtime", () => ({
  createUsageRuntime: vi.fn(),
  createUsageStore: vi.fn(),
}));

const params = {
  env: {} as IEnv,
  repositories: {} as Repositories,
  userId: 7,
  runId: "run-1",
};

describe("reserveSandboxRun", () => {
  it("stops a pool-funded run the pool can't cover", async () => {
    const { runtime } = createFakeRuntime({
      pool: { included_credit_micros: 1 },
      poolReserved: false,
    });

    vi.mocked(createUsageRuntime).mockReturnValue(runtime);

    await expect(
      reserveSandboxRun({ ...params, workspaceId: "workspace-1" }),
    ).rejects.toMatchObject({ type: ErrorType.USAGE_LIMIT_ERROR });
  });

  it("does not start a pool-funded run when the hold cannot be confirmed", async () => {
    const { runtime, store } = createFakeRuntime({ pool: { included_credit_micros: 1 } });

    store.createWorkspaceReservationWithPool.mockRejectedValue(new Error("database unavailable"));
    vi.mocked(createUsageRuntime).mockReturnValue(runtime);

    await expect(
      reserveSandboxRun({ ...params, workspaceId: "workspace-1" }),
    ).rejects.toMatchObject({ type: ErrorType.USAGE_LIMIT_ERROR });
  });

  it("leaves a personal run's reservation best-effort", async () => {
    const { runtime, store } = createFakeRuntime();

    store.createReservation.mockRejectedValue(new Error("database unavailable"));
    vi.mocked(createUsageRuntime).mockReturnValue(runtime);

    await expect(reserveSandboxRun(params)).resolves.toBeUndefined();
  });
});
