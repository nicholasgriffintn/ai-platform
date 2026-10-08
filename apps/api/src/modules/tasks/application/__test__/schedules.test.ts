import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  purgeSettledTasks: vi.fn(),
  recoverFailedDurableTasks: vi.fn(),
  redispatchPendingTasks: vi.fn(),
  scheduleRecipeExecutions: vi.fn(),
  scheduleStripeUsageSync: vi.fn(),
  reapComposioConnectorSessions: vi.fn(),
  deleteExpiredConnectorOperationApprovals: vi.fn(),
  releaseExpiredChatRunReservations: vi.fn(),
  sweepInterruptedChatRuns: vi.fn(),
  schedulePendingTaskNotificationDeliveries: vi.fn(),
  scheduleKnowledgeSyncs: vi.fn(),
  scheduleKnowledgeIndexes: vi.fn(),
}));

vi.mock("../scheduledTasks", () => ({
  purgeSettledTasks: mocks.purgeSettledTasks,
  recoverFailedDurableTasks: mocks.recoverFailedDurableTasks,
  redispatchPendingTasks: mocks.redispatchPendingTasks,
  scheduleDailySynthesis: vi.fn(),
  scheduleInfraReconciliation: vi.fn(),
  scheduleRecipeExecutions: mocks.scheduleRecipeExecutions,
  scheduleStripeUsageSync: mocks.scheduleStripeUsageSync,
  scheduleTrainingQualityScoring: vi.fn(),
}));

vi.mock("~/modules/apps/application/connectors/composio-cleanup", () => ({
  reapComposioConnectorSessions: mocks.reapComposioConnectorSessions,
}));

vi.mock("~/modules/apps/application/connectors/connector-approval-cleanup", () => ({
  deleteExpiredConnectorOperationApprovals: mocks.deleteExpiredConnectorOperationApprovals,
}));

vi.mock("~/modules/chat-runs/application/interrupted-run-sweep", () => ({
  sweepInterruptedChatRuns: mocks.sweepInterruptedChatRuns,
}));

vi.mock("~/modules/chat-runs/application/reservation-maintenance", () => ({
  releaseExpiredChatRunReservations: mocks.releaseExpiredChatRunReservations,
}));

vi.mock("~/modules/model-governance/application/maintenance", () => ({
  runModelGovernanceMaintenance: vi.fn().mockResolvedValue({ expired: 0, replays: 0 }),
  scheduleModelPlatformReconciles: vi.fn().mockResolvedValue(0),
  reconcileModelPlatform: vi.fn().mockResolvedValue({ paused: 0, resynced: 0 }),
}));

vi.mock("~/modules/task-notifications/application/delivery", () => ({
  schedulePendingTaskNotificationDeliveries: mocks.schedulePendingTaskNotificationDeliveries,
  TaskNotificationDeliveryHandler: vi.fn(),
}));

vi.mock("~/modules/sources/application/knowledge-sync-run", () => ({
  scheduleKnowledgeSyncs: mocks.scheduleKnowledgeSyncs,
}));

vi.mock("~/modules/sources/application/knowledge-index", () => ({
  scheduleKnowledgeIndexes: mocks.scheduleKnowledgeIndexes,
}));

import { SCHEDULES } from "~/config/schedules";

import { workflows } from "../registry";

describe("registered recipe schedules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.scheduleRecipeExecutions.mockResolvedValue(undefined);
    mocks.redispatchPendingTasks.mockResolvedValue(0);
    mocks.reapComposioConnectorSessions.mockResolvedValue({ deleted: 0, failed: 0 });
    mocks.deleteExpiredConnectorOperationApprovals.mockResolvedValue(0);
    mocks.purgeSettledTasks.mockResolvedValue(0);
    mocks.recoverFailedDurableTasks.mockResolvedValue(0);
    mocks.scheduleStripeUsageSync.mockResolvedValue(undefined);
    mocks.releaseExpiredChatRunReservations.mockResolvedValue(0);
    mocks.schedulePendingTaskNotificationDeliveries.mockResolvedValue(0);
    mocks.scheduleKnowledgeSyncs.mockResolvedValue(0);
    mocks.scheduleKnowledgeIndexes.mockResolvedValue(0);
  });

  it("isolates maintenance failures from recipe scheduling", async () => {
    mocks.scheduleKnowledgeSyncs.mockRejectedValueOnce(new Error("knowledge sync unavailable"));
    mocks.scheduleKnowledgeIndexes.mockRejectedValueOnce(new Error("knowledge index unavailable"));
    mocks.reapComposioConnectorSessions.mockRejectedValueOnce(new Error("reaper unavailable"));
    mocks.deleteExpiredConnectorOperationApprovals.mockRejectedValueOnce(
      new Error("approval cleanup unavailable"),
    );
    mocks.purgeSettledTasks.mockRejectedValueOnce(new Error("purge unavailable"));

    const report = await workflows.runCron({} as never, {
      cron: SCHEDULES.RECIPE_EXECUTION,
      scheduledTime: Date.parse("2026-09-01T14:15:00Z"),
    });

    expect(mocks.scheduleRecipeExecutions).toHaveBeenCalledOnce();
    expect(report.failed.map(({ name }) => name)).toEqual([
      "source-knowledge-sync",
      "source-knowledge-index",
      "composio-session-reaper",
      "connector-approval-cleanup",
      "settled-task-purge",
    ]);
  });

  it("schedules Stripe usage sync only on top-of-hour invocations", async () => {
    await workflows.runCron({} as never, {
      cron: SCHEDULES.RECIPE_EXECUTION,
      scheduledTime: Date.parse("2026-09-01T14:00:00Z"),
    });

    expect(mocks.scheduleStripeUsageSync).toHaveBeenCalledWith(
      expect.anything(),
      new Date("2026-09-01T14:00:00Z"),
    );

    vi.clearAllMocks();

    await workflows.runCron({} as never, {
      cron: SCHEDULES.RECIPE_EXECUTION,
      scheduledTime: Date.parse("2026-09-01T14:15:00Z"),
    });

    expect(mocks.scheduleStripeUsageSync).not.toHaveBeenCalled();
  });
});
