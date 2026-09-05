import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import {
  listProjectTaskAttention,
  registerTaskNotification,
  resolveTaskNotificationDeepLink,
  updateTaskInboxReceipts,
} from "../attention";

function context(overrides: Record<string, unknown> = {}): ServiceContext {
  const serviceContext: ServiceContext = Object.assign(Object.create(null), {
    env: {},
    requireUser: vi.fn().mockReturnValue({ id: 7, plan_id: "pro" }),
    repositories: {
      taskNotifications: {
        listInbox: vi.fn().mockResolvedValue([]),
        updateInboxReceipts: vi.fn().mockResolvedValue(1),
        upsertRegistration: vi.fn().mockResolvedValue({
          id: "registration-1",
          installationId: "installation-1",
          platform: "ios",
          state: "registered",
          failureCode: null,
          updatedAt: "2026-09-05T12:00:00.000Z",
        }),
      },
      projectTasks: { getTaskById: vi.fn().mockResolvedValue(null) },
      workspaces: {
        getProject: vi.fn().mockResolvedValue({
          id: "project-1",
          workspace_id: "workspace-1",
        }),
        getWorkspace: vi.fn().mockResolvedValue({ id: "workspace-1" }),
        getMembership: vi.fn().mockResolvedValue({ role: "member" }),
      },
    },
    ...overrides,
  });

  return serviceContext;
}

describe("task attention inbox", () => {
  it("projects current failures and completions without changing task authority", async () => {
    const serviceContext = context();

    vi.mocked(serviceContext.repositories.taskNotifications.listInbox).mockResolvedValue([
      {
        task_id: "failed-task",
        task_version: 3,
        project_id: "project-1",
        workspace_id: "workspace-1",
        project_name: "Launch",
        objective: "Publish release",
        status: "blocked",
        blocked_reason: "run_failed",
        blocked_detail: "The provider stopped",
        assignee_user_id: null,
        created_by_user_id: 7,
        conversation_id: "conversation-1",
        updated_at: "2026-09-05T12:00:00.000Z",
        completed_at: null,
        read_at: null,
      },
      {
        task_id: "done-task",
        task_version: 2,
        project_id: "project-1",
        workspace_id: "workspace-1",
        project_name: "Launch",
        objective: "Write notes",
        status: "done",
        blocked_reason: null,
        blocked_detail: null,
        assignee_user_id: 7,
        created_by_user_id: 7,
        conversation_id: null,
        updated_at: "2026-09-05T12:01:00.000Z",
        completed_at: "2026-09-05T12:01:00.000Z",
        read_at: "2026-09-05T12:02:00.000Z",
      },
    ]);

    const response = await listProjectTaskAttention(serviceContext);

    expect(response).toMatchObject({ total: 2, unread: 1 });
    expect(response.items.map((item) => [item.id, item.kind, item.requiresAction])).toEqual([
      ["failed-task:v3", "blocked", true],
      ["done-task:v2", "completion", false],
    ]);
  });

  it("stores read and dismiss receipts separately from project tasks", async () => {
    const serviceContext = context();

    await expect(
      updateTaskInboxReceipts(serviceContext, ["task-1:v2"], "dismiss"),
    ).resolves.toEqual({ updated: 1 });
    expect(serviceContext.repositories.taskNotifications.updateInboxReceipts).toHaveBeenCalledWith(
      7,
      ["task-1:v2"],
      "dismiss",
    );
    expect(serviceContext.repositories.projectTasks.getTaskById).not.toHaveBeenCalled();
  });

  it("owns registration by the authenticated account and installation", async () => {
    const serviceContext = context();
    const input = {
      platform: "ios" as const,
      installationId: "installation-1",
      token: "a".repeat(64),
    };

    await expect(registerTaskNotification(serviceContext, input)).resolves.toMatchObject({
      registration: { state: "registered" },
    });
    expect(serviceContext.repositories.taskNotifications.upsertRegistration).toHaveBeenCalledWith(
      7,
      input,
    );
  });

  it("makes a superseded deep link non-actionable after rechecking membership", async () => {
    const serviceContext = context();
    const task: ProjectTask = {
      id: "task-1",
      projectId: "project-1",
      workspaceId: "workspace-1",
      objective: "Approve release",
      acceptanceCriteria: [],
      expectedOutput: null,
      context: null,
      constraints: null,
      dependsOnTaskIds: [],
      requireApprovalFor: [],
      status: "running",
      source: "user",
      blockedReason: null,
      blockedDetail: null,
      stageId: null,
      runner: null,
      createdByUserId: 7,
      assigneeUserId: null,
      runnerIdentityUserId: null,
      conversationId: null,
      goalId: null,
      dispatchTaskId: null,
      runId: null,
      completions: [],
      position: 1,
      tokenBudget: null,
      tokensSpent: 0,
      createdAt: "2026-09-05T11:00:00.000Z",
      updatedAt: "2026-09-05T12:00:00.000Z",
      startedAt: "2026-09-05T11:01:00.000Z",
      completedAt: null,
      attentionVersion: 4,
    };

    vi.mocked(serviceContext.repositories.projectTasks.getTaskById).mockResolvedValue(task);

    await expect(resolveTaskNotificationDeepLink(serviceContext, "task-1:v3")).resolves.toEqual({
      protocolVersion: 1,
      itemId: "task-1:v3",
      current: false,
      deepLink: null,
    });
    expect(serviceContext.repositories.workspaces.getMembership).toHaveBeenCalledWith(
      "workspace-1",
      7,
    );
  });
});
