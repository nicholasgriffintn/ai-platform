import type {
  ProjectTaskSource,
  ProjectTaskStatus,
  ToolPermission,
} from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ActivityRepository } from "~/modules/activity/infrastructure/ActivityRepository";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { ConnectorOperationApprovalRepository } from "~/modules/connectors/infrastructure/ConnectorOperationApprovalRepository";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { GoalRepository } from "~/modules/goals/infrastructure/GoalRepository";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { resolveProjectTaskToolApproval } from "../approvals";
import { resolveTaskRuntime } from "../flow";
import { createProjectTask, respondToProjectTaskToolApproval } from "../index";
import { queueProjectTaskRun } from "../runner";
import { assertProjectTaskTransition } from "../transitions";

const baseTask = {
  id: "task-1",
  projectId: "project-1",
  workspaceId: "workspace-1",
  key: null,
  number: null,
  kind: "task" as const,
  description: null,
  priority: "none" as const,
  parentTaskId: null,
  startAt: null,
  dueAt: null,
  owner: null,
  reviewer: null,
  details: {},
  objective: "Ship the pricing note",
  acceptanceCriteria: [],
  assumptions: [],
  killConditions: [],
  retrospective: null,
  expectedOutput: null,
  context: null,
  constraints: null,
  dependsOnTaskIds: [] as string[],
  requireApprovalFor: [] as ToolPermission[],
  status: "backlog" as ProjectTaskStatus,
  source: "user" as ProjectTaskSource,
  blockedReason: null,
  blockedDetail: null,
  stageId: null,
  flowSnapshot: null,
  runner: null,
  createdByUserId: 7,
  assigneeUserId: null,
  runnerIdentityUserId: null,
  conversationId: null,
  goalId: null,
  dispatchTaskId: null,
  runId: null,
  completions: [],
  position: 1000,
  tokenBudget: null,
  tokensSpent: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: null,
  startedAt: null,
  completedAt: null,
};

function createContext(
  overrides: {
    task?: Partial<typeof baseTask>;
    flow?: string | null;
    role?: string;
    memberships?: Record<number, boolean>;
    capabilities?: { kind: string; capability_id: string }[];
    teammate?: Record<string, unknown> | null;
    activeCount?: number;
    boardTasks?: unknown[];
    project?: Record<string, unknown>;
  } = {},
) {
  const task = { ...baseTask, ...overrides.task };
  const updateTask = vi
    .fn()
    .mockImplementation(async (_id: string, updates: Record<string, unknown>) => ({
      ...task,
      ...updates,
    }));
  const createConversation = vi.fn().mockResolvedValue({ id: "task_task-1" });
  const cancelActiveActivitiesByGroup = vi.fn().mockResolvedValue(undefined);
  const getDispatchTask = vi.fn().mockResolvedValue({
    id: task.dispatchTaskId,
    status: "running",
  });
  const cancelDispatchTask = vi.fn().mockResolvedValue({ id: "dispatch-1" });
  const getGoalById = vi.fn().mockResolvedValue({
    id: task.goalId,
    status: "active",
  });
  const updateGoal = vi.fn().mockResolvedValue({
    id: task.goalId,
    status: "cleared",
  });

  return {
    context: {
      env: {},
      ensureDatabase: vi.fn(),
      requireUser: vi.fn().mockReturnValue({ id: 7, plan_id: "pro" }),
      repositories: fakeRepositories([
        [
          WorkspaceRepository,
          {
            getProject: vi.fn().mockResolvedValue({
              id: "project-1",
              workspace_id: "workspace-1",
              name: "Pricing",
              flow: overrides.flow ?? null,
              ...overrides.project,
            }),
            getWorkspace: vi.fn().mockResolvedValue({ id: "workspace-1" }),
            getMembership: vi.fn().mockImplementation(async (_workspaceId, userId: number) => {
              const memberships = overrides.memberships ?? { 7: true };

              return memberships[userId] ? { role: overrides.role ?? "owner" } : null;
            }),
            listProjectCapabilities: vi.fn().mockResolvedValue(overrides.capabilities ?? []),
            updateProject: vi.fn().mockResolvedValue(undefined),
          },
        ],
        [
          TeammateRepository,
          {
            getTeammateById: vi.fn().mockResolvedValue(overrides.teammate ?? null),
            listWorkspaceDefaults: vi.fn().mockResolvedValue([]),
            listPlatformTeammates: vi.fn().mockResolvedValue([]),
            upsertPlatformTeammates: vi.fn().mockResolvedValue(undefined),
          },
        ],
        [
          ProjectTaskRepository,
          {
            getTaskById: vi.fn().mockResolvedValue(task),
            listProjectTasks: vi.fn().mockResolvedValue(overrides.boardTasks ?? [task]),
            getMaxPosition: vi.fn().mockResolvedValue(0),
            allocateTaskNumber: vi.fn().mockResolvedValue({ number: 1, key: "TSK-1" }),
            countActiveTasks: vi.fn().mockResolvedValue(overrides.activeCount ?? 0),
            createTask: vi.fn().mockResolvedValue({ task, created: true }),
            updateTask,
          },
        ],
        [AuditRepository, { createRecord: vi.fn().mockResolvedValue(undefined) }],
        [
          ConversationRepository,
          {
            getConversation: vi.fn().mockResolvedValue(null),
            createConversation,
          },
        ],
        [
          TaskRepository,
          {
            getTaskById: getDispatchTask,
            cancelOpenTask: cancelDispatchTask,
          },
        ],
        [
          GoalRepository,
          {
            getGoalById,
            updateGoal,
          },
        ],
        [
          ActivityRepository,
          {
            cancelActiveActivitiesByGroup,
          },
        ],
        [
          ConnectorOperationApprovalRepository,
          {
            listConsumedRunIds: vi.fn().mockResolvedValue(new Set()),
          },
        ],
      ]),
    } as unknown as ServiceContext,
    updateTask,
    createConversation,
    cancelActiveActivitiesByGroup,
    getDispatchTask,
    cancelDispatchTask,
    getGoalById,
    updateGoal,
  };
}

vi.mock("../runner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../runner")>();

  return {
    ...actual,
    queueProjectTaskRun: vi
      .fn()
      .mockImplementation(async ({ context, task, runnerIdentityUserId, stageId }) =>
        context.repositories.get(ProjectTaskRepository).updateTask(task.id, {
          status: "queued",
          runnerIdentityUserId,
          stageId: stageId ?? task.stageId,
        }),
      ),
  };
});

vi.mock("../approvals", () => ({
  resolveProjectTaskToolApproval: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveProjectTaskToolApproval).mockResolvedValue({
    toolName: "use_recipe_connector",
    resolution: "approved",
  });
});

describe("project task transitions", () => {
  it("refuses to let the model mark a task done", () => {
    expect(() =>
      assertProjectTaskTransition({
        actor: "model",
        from: "review",
        to: "done",
      }),
    ).toThrow(
      expect.objectContaining({
        message: expect.stringContaining("accepted by a person"),
        statusCode: 403,
      }),
    );
  });

  it("refuses to let the runner reopen a finished task", () => {
    expect(() =>
      assertProjectTaskTransition({
        actor: "system",
        from: "done",
        to: "running",
      }),
    ).toThrow(expect.objectContaining({ statusCode: 403 }));
  });
});

describe("createProjectTask", () => {
  it("rejects an assignee who is not a member of the workspace", async () => {
    const { context } = createContext({ memberships: { 7: true } });

    await expect(
      createProjectTask(context, "project-1", {
        objective: "Ship the pricing note",
        assigneeUserId: 99,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("startProjectTask", () => {
  it("checks current workspace membership before resolving an approval", async () => {
    const { context } = createContext({
      task: { status: "blocked", blockedReason: "awaiting_approval" },
      memberships: { 7: false },
    });

    await expect(
      respondToProjectTaskToolApproval(context, "project-1", "task-1", {
        interactionId: "approval-1",
        resolution: "approved",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(resolveProjectTaskToolApproval).not.toHaveBeenCalled();
    expect(queueProjectTaskRun).not.toHaveBeenCalled();
  });
});

describe("resolveTaskRuntime", () => {
  it("refuses an attached teammate that now belongs to another workspace", async () => {
    const { context } = createContext({
      capabilities: [{ kind: "teammate", capability_id: "teammate-1" }],
      teammate: {
        id: "teammate-1",
        user_id: 7,
        owner_scope_type: "workspace",
        owner_scope_id: "workspace-2",
        enabled_tools: null,
      },
    });

    await expect(
      resolveTaskRuntime({
        context,
        task: {
          ...baseTask,
          runner: {
            kind: "conversation",
            teammateId: "teammate-1",
            model: null,
            mode: null,
          },
        },
        flow: null,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
