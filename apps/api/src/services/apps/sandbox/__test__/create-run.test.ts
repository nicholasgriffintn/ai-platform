import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveSandboxModel } from "~/services/sandbox/worker";

import { prepareSandboxRun } from "../create-run";
import { appendRunCoordinatorEvent, initRunCoordinatorControl } from "../run-coordinator";

vi.mock("~/services/sandbox/worker", () => ({ resolveSandboxModel: vi.fn() }));
vi.mock("../run-coordinator", () => ({
  appendRunCoordinatorEvent: vi.fn(),
  initRunCoordinatorControl: vi.fn(),
  updateRunCoordinatorControl: vi.fn(),
}));

describe("prepareSandboxRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveSandboxModel).mockResolvedValue("labs-leanstral-1-5");
  });

  it("reuses the exact persisted preparation at the concurrency limit after a crash", async () => {
    let storedRecord: Record<string, unknown> | null = null;
    const getActivityById = vi.fn().mockImplementation(async () => storedRecord);
    const listRecentUserActivities = vi.fn().mockImplementation(async () =>
      storedRecord
        ? [
            {
              ...storedRecord,
              status: "queued",
            },
          ]
        : [],
    );
    const createActivity = vi.fn().mockImplementation(async (input) => {
      storedRecord ??= {
        id: input.id,
        created_by_user_id: input.createdByUserId,
        project_id: input.projectId ?? null,
        conversation_id: input.conversationId ?? null,
        capability_id: input.capabilityId,
        group_id: input.groupId,
        kind: input.kind,
        status: input.status,
        summary: input.summary,
        data: JSON.stringify(input.data),
        created_at: "2026-08-31T10:00:00.000Z",
        updated_at: "2026-08-31T10:00:00.000Z",
      };

      return storedRecord;
    });
    const context = {
      env: { SANDBOX_MAX_CONCURRENT_RUNS: "1" } as any,
      repositories: {
        activities: { createActivity, getActivityById, listRecentUserActivities },
      },
    };
    const projectTaskContext = {
      dispatchTaskId: "dispatch-1",
      taskId: "task-1",
      projectId: "project-1",
      workspaceId: "workspace-1",
      runnerIdentityUserId: 7,
    };
    const params = {
      env: {} as any,
      context: context as any,
      user: { id: 7, plan_id: "pro" } as any,
      projectId: "project-1",
      runId: "lean-proof-run-dispatch-1",
      activityId: "sandbox-activity-lean-proof-run-dispatch-1",
      payload: {
        installationId: 42,
        repo: "owner/repo",
        task: "Prove the target",
        taskType: "lean-proof" as const,
        model: "labs-leanstral-1-5",
        shouldCommit: true,
        leanProof: {
          targetPaths: ["Main.lean"],
          declarations: [],
          objective: "Prove the target",
          acceptanceCriteria: [],
        },
        tokenBudget: 1000,
        projectTaskContext,
      },
    };

    const first = await prepareSandboxRun(params);
    const recovered = await prepareSandboxRun(params);

    expect(first.record.id).toBe("sandbox-activity-lean-proof-run-dispatch-1");
    expect(recovered.record.id).toBe(first.record.id);
    expect(recovered.run).toEqual(first.run);
    expect(createActivity).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: "sandbox-activity-lean-proof-run-dispatch-1",
        groupId: "lean-proof-run-dispatch-1",
      }),
    );
    expect(listRecentUserActivities).toHaveBeenCalledTimes(1);
    expect(initRunCoordinatorControl).toHaveBeenCalledTimes(2);
    expect(appendRunCoordinatorEvent).toHaveBeenCalledTimes(2);
  });
});
