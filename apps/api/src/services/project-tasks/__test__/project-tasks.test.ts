import type { ProjectTaskSource, ProjectTaskStatus } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { intersectAgentTools } from "../flow";
import {
  acceptProjectTask,
  createProjectTask,
  setProjectFlow,
  startProjectTask,
  updateProjectTask,
} from "../index";
import { assertProjectTaskTransition, projectTaskStatusForGoal } from "../transitions";

const baseTask = {
  id: "task-1",
  projectId: "project-1",
  workspaceId: "workspace-1",
  objective: "Ship the pricing note",
  acceptance: null,
  status: "backlog" as ProjectTaskStatus,
  source: "user" as ProjectTaskSource,
  blockedReason: null,
  blockedDetail: null,
  stageId: null,
  runner: null,
  createdByUserId: 7,
  assigneeUserId: null,
  runnerIdentityUserId: null,
  conversationId: null,
  goalId: null,
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
    activeCount?: number;
  } = {},
) {
  const task = { ...baseTask, ...overrides.task };
  const updateTask = vi
    .fn()
    .mockImplementation(async (_id: string, updates: Record<string, unknown>) => ({
      ...task,
      ...updates,
    }));

  return {
    context: {
      env: {},
      requireUser: vi.fn().mockReturnValue({ id: 7, plan_id: "pro" }),
      repositories: {
        workspaces: {
          getProject: vi.fn().mockResolvedValue({
            id: "project-1",
            workspace_id: "workspace-1",
            name: "Pricing",
            flow: overrides.flow ?? null,
          }),
          getWorkspace: vi.fn().mockResolvedValue({ id: "workspace-1" }),
          getMembership: vi.fn().mockImplementation(async (_workspaceId, userId: number) => {
            const memberships = overrides.memberships ?? { 7: true };

            return memberships[userId] ? { role: overrides.role ?? "owner" } : null;
          }),
          listProjectCapabilities: vi.fn().mockResolvedValue(overrides.capabilities ?? []),
          updateProject: vi.fn().mockResolvedValue(undefined),
        },
        projectTasks: {
          getTaskById: vi.fn().mockResolvedValue(task),
          getMaxPosition: vi.fn().mockResolvedValue(0),
          countActiveTasks: vi.fn().mockResolvedValue(overrides.activeCount ?? 0),
          createTask: vi.fn().mockResolvedValue(task),
          updateTask,
        },
        audit: { createRecord: vi.fn().mockResolvedValue(undefined) },
        tasks: {},
      },
    } as unknown as ServiceContext,
    updateTask,
  };
}

vi.mock("../runner", () => ({
  enqueueProjectTaskRun: vi.fn().mockResolvedValue(undefined),
  projectTaskConversationId: (taskId: string) => `task_${taskId}`,
}));

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

  it("lets a person accept work the model put up for review", () => {
    expect(() =>
      assertProjectTaskTransition({
        actor: "user",
        from: "review",
        to: "done",
      }),
    ).not.toThrow();
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

  it("maps a completed goal to review rather than done", () => {
    expect(projectTaskStatusForGoal({ status: "completed" })).toEqual({
      status: "review",
      blockedReason: null,
    });
  });

  it("maps a stalled or limited goal to blocked with its reason", () => {
    expect(projectTaskStatusForGoal({ status: "stalled" })).toEqual({
      status: "blocked",
      blockedReason: "stalled",
    });
    expect(projectTaskStatusForGoal({ status: "limit_reached" })).toEqual({
      status: "blocked",
      blockedReason: "usage_limits",
    });
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

describe("updateProjectTask", () => {
  it("blocks a model actor from moving a task to done through the API", async () => {
    const { context } = createContext({ task: { status: "review" } });

    await expect(
      updateProjectTask(context, "project-1", "task-1", { status: "done" }, { actor: "model" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("startProjectTask", () => {
  it("makes the caller the run identity rather than the assignee", async () => {
    const { context, updateTask } = createContext({
      task: { assigneeUserId: 12 },
    });

    await startProjectTask(context, "project-1", "task-1");

    expect(updateTask).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({ status: "queued", runnerIdentityUserId: 7 }),
    );
  });

  it("refuses to start work when the project is already at its concurrency cap", async () => {
    const { context } = createContext({ activeCount: 3 });

    await expect(startProjectTask(context, "project-1", "task-1")).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe("acceptProjectTask", () => {
  it("advances to the next flow stage instead of finishing when one exists", async () => {
    const flow = JSON.stringify({
      stages: [
        {
          id: "spec",
          name: "Spec",
          agentId: null,
          skillId: null,
          mode: null,
          requiresApprovalFor: [],
          advance: "on_human_accept",
        },
        {
          id: "build",
          name: "Build",
          agentId: null,
          skillId: null,
          mode: null,
          requiresApprovalFor: [],
          advance: "on_human_accept",
        },
      ],
    });
    const { context, updateTask } = createContext({
      task: { status: "review", stageId: "spec" },
      flow,
    });

    await acceptProjectTask(context, "project-1", "task-1");

    expect(updateTask).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({ status: "backlog", stageId: "build" }),
    );
  });

  it("finishes the task when it is on the last stage", async () => {
    const { context, updateTask } = createContext({
      task: { status: "review" },
    });

    await acceptProjectTask(context, "project-1", "task-1");

    expect(updateTask).toHaveBeenCalledWith("task-1", expect.objectContaining({ status: "done" }));
  });
});

describe("setProjectFlow", () => {
  it("refuses a stage naming an agent the project has not attached", async () => {
    const { context } = createContext({ capabilities: [] });

    await expect(
      setProjectFlow(context, "project-1", {
        stages: [
          {
            id: "build",
            name: "Build",
            agentId: "agent-1",
            skillId: null,
            mode: null,
            requiresApprovalFor: [],
            advance: "on_goal_complete",
          },
        ],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("intersectAgentTools", () => {
  it("narrows an agent's tools to the project's rather than widening them", () => {
    expect(intersectAgentTools(["web_search", "run_sandbox_task"], ["web_search"])).toEqual([
      "web_search",
    ]);
  });

  it("gives an agent with no declared tools exactly the project's tools", () => {
    expect(intersectAgentTools(null, ["web_search"])).toEqual(["web_search"]);
  });
});
