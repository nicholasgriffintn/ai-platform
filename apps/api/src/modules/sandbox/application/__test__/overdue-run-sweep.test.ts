import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ActivityRepository } from "~/modules/activity/infrastructure/ActivityRepository";

import { failSandboxRun } from "../dispatch";
import { sweepOverdueSandboxRuns } from "../overdue-run-sweep";
import { getRunCoordinatorControl } from "../run-coordinator";

vi.mock("~/infrastructure/context/serviceContext", () => ({ createServiceContext: vi.fn() }));
vi.mock("../dispatch", () => ({ failSandboxRun: vi.fn(async () => undefined) }));
vi.mock("../run-coordinator", () => ({ getRunCoordinatorControl: vi.fn() }));

const now = new Date("2026-11-07T12:00:00.000Z");
const listActive = vi.fn();

function record(startedAt: string) {
  return {
    id: "record-1",
    group_id: "run-1",
    created_by_user_id: 42,
    data: JSON.stringify({
      runId: "run-1",
      installationId: 99,
      status: "running",
      repo: "owner/repo",
      task: "Task",
      model: "mistral-large",
      shouldCommit: true,
      startedAt,
      updatedAt: startedAt,
      processingStartedAt: startedAt,
      timeoutSeconds: 600,
      events: [],
    }),
  };
}

describe("sweepOverdueSandboxRuns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createServiceContext).mockReturnValue({
      env: {},
      repositories: fakeRepositories([
        [ActivityRepository, { listActiveActivitiesUpdatedBefore: listActive }],
      ]),
    } as any);
  });

  it("fails a run that has outlived its time limit", async () => {
    listActive.mockResolvedValue([record("2026-11-07T11:00:00.000Z")]);
    vi.mocked(getRunCoordinatorControl).mockResolvedValue({
      state: "running",
      updatedAt: "2026-11-07T11:00:00.000Z",
    } as any);

    await expect(sweepOverdueSandboxRuns({} as any, now)).resolves.toBe(1);

    expect(failSandboxRun).toHaveBeenCalledWith(
      expect.objectContaining({
        message: { runId: "run-1", recordId: "record-1", userId: 42 },
      }),
    );
  });

  it("leaves a run that is still inside its time limit", async () => {
    listActive.mockResolvedValue([record("2026-11-07T11:55:00.000Z")]);
    vi.mocked(getRunCoordinatorControl).mockResolvedValue({
      state: "running",
      updatedAt: "2026-11-07T11:55:00.000Z",
    } as any);

    await expect(sweepOverdueSandboxRuns({} as any, now)).resolves.toBe(0);
    expect(failSandboxRun).not.toHaveBeenCalled();
  });

  it("restarts the clock when a paused run is resumed", async () => {
    listActive.mockResolvedValue([record("2026-11-07T09:00:00.000Z")]);
    vi.mocked(getRunCoordinatorControl).mockResolvedValue({
      state: "running",
      updatedAt: "2026-11-07T11:55:00.000Z",
    } as any);

    await expect(sweepOverdueSandboxRuns({} as any, now)).resolves.toBe(0);
  });

  it.each(["paused", "inspection"])("leaves a run that is %s", async (state) => {
    listActive.mockResolvedValue([record("2026-11-07T09:00:00.000Z")]);
    vi.mocked(getRunCoordinatorControl).mockResolvedValue({
      state,
      updatedAt: "2026-11-07T09:00:00.000Z",
    } as any);

    await expect(sweepOverdueSandboxRuns({} as any, now)).resolves.toBe(0);
  });
});
