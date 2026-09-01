import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redispatchPendingTasks: vi.fn(),
  scheduleRecipeExecutions: vi.fn(),
  scheduleStripeUsageSync: vi.fn(),
  reapComposioConnectorSessions: vi.fn(),
  deleteExpiredConnectorOperationApprovals: vi.fn(),
}));

vi.mock("../scheduledTasks", () => ({
  redispatchPendingTasks: mocks.redispatchPendingTasks,
  scheduleDailyUsageReset: vi.fn(),
  scheduleDailySynthesis: vi.fn(),
  scheduleRecipeExecutions: mocks.scheduleRecipeExecutions,
  scheduleStripeUsageSync: mocks.scheduleStripeUsageSync,
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

describe("ScheduleExecutor stripe usage sync gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.scheduleRecipeExecutions.mockResolvedValue(undefined);
    mocks.redispatchPendingTasks.mockResolvedValue(0);
    mocks.reapComposioConnectorSessions.mockResolvedValue({ deleted: 0, failed: 0 });
    mocks.deleteExpiredConnectorOperationApprovals.mockResolvedValue(0);
    mocks.scheduleStripeUsageSync.mockResolvedValue(undefined);
  });

  it("schedules the sync only on the top-of-hour invocation", async () => {
    await ScheduleExecutor.respondToCronSchedules(
      {} as never,
      {
        cron: SCHEDULES.RECIPE_EXECUTION,
        scheduledTime: Date.parse("2026-09-01T14:00:00Z"),
      } as ScheduledController,
    );

    expect(mocks.scheduleStripeUsageSync).toHaveBeenCalledWith(
      expect.anything(),
      new Date("2026-09-01T14:00:00Z"),
    );
  });

  it("does not schedule the sync on quarter-hour invocations", async () => {
    await ScheduleExecutor.respondToCronSchedules(
      {} as never,
      {
        cron: SCHEDULES.RECIPE_EXECUTION,
        scheduledTime: Date.parse("2026-09-01T14:15:00Z"),
      } as ScheduledController,
    );

    expect(mocks.scheduleStripeUsageSync).not.toHaveBeenCalled();
  });

  it("does not let a sync scheduling failure block recipe scheduling", async () => {
    mocks.scheduleStripeUsageSync.mockRejectedValueOnce(new Error("queue unavailable"));

    await expect(
      ScheduleExecutor.respondToCronSchedules(
        {} as never,
        {
          cron: SCHEDULES.RECIPE_EXECUTION,
          scheduledTime: Date.parse("2026-09-01T15:00:00Z"),
        } as ScheduledController,
      ),
    ).resolves.toBeUndefined();

    expect(mocks.scheduleRecipeExecutions).toHaveBeenCalledOnce();
  });
});
