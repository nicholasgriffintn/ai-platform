import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { NotificationRepository } from "~/modules/notifications/infrastructure/NotificationRepository";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { TaskNotificationRepository } from "~/modules/task-notifications/infrastructure/TaskNotificationRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { resolveTaskNotificationDeepLink } from "../attention";

function projectTask(overrides: Partial<ProjectTask> = {}): ProjectTask {
  return {
    id: "task-1",
    projectId: "project-1",
    workspaceId: "workspace-1",
    key: null,
    number: null,
    kind: "task",
    description: null,
    priority: "none",
    parentTaskId: null,
    startAt: null,
    dueAt: null,
    owner: null,
    reviewer: null,
    details: {},
    objective: "Approve release",
    acceptanceCriteria: [],
    assumptions: [],
    killConditions: [],
    retrospective: null,
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
    ...overrides,
  };
}

function context(overrides: Record<string, unknown> = {}): ServiceContext {
  const serviceContext: ServiceContext = Object.assign(Object.create(null), {
    env: {},
    requireUser: vi.fn().mockReturnValue({ id: 7, plan_id: "pro" }),
    repositories: fakeRepositories([
      [NotificationRepository, { updateReceipts: vi.fn().mockResolvedValue(0) }],
      [
        TaskNotificationRepository,
        {
          listInbox: vi.fn().mockResolvedValue([]),
          updateInboxReceipts: vi.fn().mockResolvedValue(1),
          upsertRegistration: vi.fn().mockResolvedValue({
            id: "registration-1",
            installationId: "installation-1",
            platform: "web",
            state: "registered",
            failureCode: null,
            updatedAt: "2026-09-05T12:00:00.000Z",
          }),
        },
      ],
      [
        ProjectTaskRepository,
        {
          getTaskById: vi.fn().mockResolvedValue(null),
        },
      ],
      [
        WorkspaceRepository,
        {
          getProject: vi.fn().mockResolvedValue({
            id: "project-1",
            workspace_id: "workspace-1",
          }),
          getWorkspace: vi.fn().mockResolvedValue({ id: "workspace-1" }),
          getMembership: vi.fn().mockResolvedValue({ role: "member" }),
        },
      ],
    ]),
    ...overrides,
  });

  return serviceContext;
}

describe("task attention inbox", () => {
  it("makes a superseded deep link non-actionable after rechecking membership", async () => {
    const serviceContext = context();
    const task = projectTask();

    vi.mocked(serviceContext.repositories.get(ProjectTaskRepository).getTaskById).mockResolvedValue(
      task,
    );

    await expect(resolveTaskNotificationDeepLink(serviceContext, "task-1:v3")).resolves.toEqual({
      protocolVersion: 1,
      itemId: "task-1:v3",
      current: false,
      deepLink: null,
    });
    vi.mocked(serviceContext.repositories.get(WorkspaceRepository).getMembership).mockResolvedValue(
      null,
    );
    await expect(
      resolveTaskNotificationDeepLink(serviceContext, "task-1:v3"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
