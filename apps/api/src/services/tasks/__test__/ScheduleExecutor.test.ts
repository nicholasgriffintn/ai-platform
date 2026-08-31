import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redispatchPendingTasks: vi.fn(),
  scheduleRecipeExecutions: vi.fn(),
  reapComposioConnectorSessions: vi.fn(),
  deleteExpiredConnectorOperationApprovals: vi.fn(),
}));

vi.mock("../scheduledTasks", () => ({
  redispatchPendingTasks: mocks.redispatchPendingTasks,
  scheduleDailyUsageReset: vi.fn(),
  scheduleDailySynthesis: vi.fn(),
  scheduleRecipeExecutions: mocks.scheduleRecipeExecutions,
  scheduleTrainingQualityScoring: vi.fn(),
}));

vi.mock("~/services/apps/connectors/composio-cleanup", () => ({
  reapComposioConnectorSessions: mocks.reapComposioConnectorSessions,
}));

vi.mock("~/services/apps/connectors/connector-approval-cleanup", () => ({
  deleteExpiredConnectorOperationApprovals: mocks.deleteExpiredConnectorOperationApprovals,
}));

import { SCHEDULES } from "~/constants/schedules";

import { ScheduleExecutor } from "../ScheduleExecutor";

describe("ScheduleExecutor connector maintenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.scheduleRecipeExecutions.mockResolvedValue(undefined);
    mocks.redispatchPendingTasks.mockResolvedValue(0);
    mocks.reapComposioConnectorSessions.mockResolvedValue({ deleted: 0, failed: 0 });
    mocks.deleteExpiredConnectorOperationApprovals.mockResolvedValue(0);
  });

  it("runs both cleanups without allowing either failure to block recipe scheduling", async () => {
    mocks.reapComposioConnectorSessions.mockRejectedValueOnce(new Error("reaper unavailable"));
    mocks.deleteExpiredConnectorOperationApprovals.mockRejectedValueOnce(
      new Error("approval cleanup unavailable"),
    );

    await expect(
      ScheduleExecutor.respondToCronSchedules(
        {} as never,
        {
          cron: SCHEDULES.RECIPE_EXECUTION,
        } as ScheduledController,
      ),
    ).resolves.toBeUndefined();

    expect(mocks.scheduleRecipeExecutions).toHaveBeenCalledOnce();
    expect(mocks.reapComposioConnectorSessions).toHaveBeenCalledOnce();
    expect(mocks.deleteExpiredConnectorOperationApprovals).toHaveBeenCalledOnce();
    expect(mocks.redispatchPendingTasks).toHaveBeenCalledOnce();
  });
});
