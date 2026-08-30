import type {
  ProjectFlow,
  ProjectTaskSource,
  ProjectTaskStatus,
  ToolPermission,
} from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { intersectEnabledTools } from "~/utils/enabledTools";

import { resolveTaskRuntime } from "../flow";
import {
  acceptProjectTask,
  createProjectTask,
  setProjectFlow,
  startProjectTask,
  updateProjectTask,
} from "../index";
import {
  buildTaskPrompt,
  ensureProjectTaskConversation,
  projectTaskConversationId,
  queueProjectTaskRun,
} from "../runner";
import { assertProjectTaskTransition, projectTaskStatusForGoal } from "../transitions";

const baseTask = {
  id: "task-1",
  projectId: "project-1",
  workspaceId: "workspace-1",
  objective: "Ship the pricing note",
  acceptanceCriteria: [],
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
  runner: null,
  createdByUserId: 7,
  assigneeUserId: null,
  runnerIdentityUserId: null,
  conversationId: null,
  goalId: null,
  dispatchTaskId: null,
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
    boardTasks?: unknown[];
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
          listProjectTasks: vi.fn().mockResolvedValue(overrides.boardTasks ?? [task]),
          getMaxPosition: vi.fn().mockResolvedValue(0),
          countActiveTasks: vi.fn().mockResolvedValue(overrides.activeCount ?? 0),
          createTask: vi.fn().mockResolvedValue(task),
          updateTask,
        },
        audit: { createRecord: vi.fn().mockResolvedValue(undefined) },
        conversations: {
          getConversation: vi.fn().mockResolvedValue(null),
          createConversation,
        },
        tasks: {},
      },
    } as unknown as ServiceContext,
    updateTask,
    createConversation,
  };
}

vi.mock("../runner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../runner")>();

  return {
    ...actual,
    queueProjectTaskRun: vi
      .fn()
      .mockImplementation(async ({ context, task, runnerIdentityUserId, stageId }) =>
        context.repositories.projectTasks.updateTask(task.id, {
          status: "queued",
          runnerIdentityUserId,
          stageId: stageId ?? task.stageId,
        }),
      ),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("projectTaskConversationId", () => {
  it("isolates a retry attempt from a failed conversation", () => {
    expect(projectTaskConversationId("task-1", "attempt-2")).toBe("task_task-1_attempt-2");
  });
});

describe("buildTaskPrompt", () => {
  it("gives the task conversation the exact task id used by its tools", () => {
    expect(
      buildTaskPrompt({ task: baseTask, stageInstructions: null, contextNotes: null }),
    ).toContain("Project task ID: task-1");
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

  it("refuses to let the model create a queued card without dispatching work", () => {
    expect(() =>
      assertProjectTaskTransition({
        actor: "model",
        from: "backlog",
        to: "queued",
      }),
    ).toThrow(expect.objectContaining({ statusCode: 403 }));
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

  it("recovers a queued task that has no dispatch", async () => {
    const flow = JSON.stringify({
      stages: [
        {
          id: "plan",
          name: "Plan",
          instructions: null,
          agentId: null,
          skillIds: [],
          mode: "plan",
          requiresApprovalFor: [],
          advance: "on_goal_complete",
        },
      ],
    });
    const { context, updateTask } = createContext({
      task: { status: "queued", dispatchTaskId: null },
      flow,
    });

    await startProjectTask(context, "project-1", "task-1");

    expect(updateTask).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({ status: "queued", runnerIdentityUserId: 7, stageId: "plan" }),
    );
  });
});

describe("acceptProjectTask", () => {
  it("queues the next flow stage immediately after a person accepts the current one", async () => {
    const flow = JSON.stringify({
      stages: [
        {
          id: "spec",
          name: "Spec",
          agentId: null,
          skillIds: [],
          mode: null,
          requiresApprovalFor: [],
          advance: "on_human_accept",
        },
        {
          id: "build",
          name: "Build",
          agentId: null,
          skillIds: [],
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
      expect.objectContaining({ status: "queued", stageId: "build", runnerIdentityUserId: 7 }),
    );
    expect(vi.mocked(queueProjectTaskRun)).toHaveBeenCalledTimes(1);
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
            instructions: null,
            agentId: "agent-1",
            skillIds: [],
            mode: null,
            requiresApprovalFor: [],
            advance: "on_goal_complete",
          },
        ],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("accepts multiple skills when every one is attached to the project", async () => {
    const { context } = createContext({
      capabilities: [
        { kind: "skill", capability_id: "research" },
        { kind: "skill", capability_id: "fact-checking" },
      ],
    });
    const flow: ProjectFlow = {
      stages: [
        {
          id: "research",
          name: "Research",
          instructions: null,
          agentId: null,
          skillIds: ["research", "fact-checking"],
          mode: "explore",
          requiresApprovalFor: [],
          advance: "on_goal_complete",
        },
      ],
    };

    await expect(setProjectFlow(context, "project-1", flow)).resolves.toEqual({ flow });
    expect(context.repositories.workspaces.updateProject).toHaveBeenCalledWith("project-1", {
      flow: JSON.stringify(flow),
    });
  });
});

describe("intersectEnabledTools", () => {
  it("narrows an agent's tools to the project's rather than widening them", () => {
    expect(intersectEnabledTools(["web_search"], ["web_search", "run_sandbox_task"])).toEqual([
      "web_search",
    ]);
  });

  it("gives an agent with no declared tools exactly the project's tools", () => {
    expect(intersectEnabledTools(["web_search"], null)).toEqual(["web_search"]);
  });
});

describe("resolveTaskRuntime", () => {
  const flow: ProjectFlow = {
    stages: [
      {
        id: "build",
        name: "Build",
        instructions: null,
        agentId: null,
        skillIds: [],
        mode: "build",
        requiresApprovalFor: ["network", "write"],
        advance: "on_human_accept",
      },
    ],
  };

  it("carries the stage approval policy into the run", async () => {
    const { context } = createContext();
    const runtime = await resolveTaskRuntime({
      context,
      task: { ...baseTask, stageId: "build" },
      flow,
    });

    expect(runtime.requireApprovalFor).toEqual(["network", "write"]);
    expect(runtime.mode).toBe("build");
    expect(runtime.enabledTools).toEqual(
      expect.arrayContaining(["get_task", "list_tasks", "update_task"]),
    );
  });

  it("keeps the runner model when the stage sets a mode", async () => {
    const { context } = createContext();
    const runtime = await resolveTaskRuntime({
      context,
      task: {
        ...baseTask,
        stageId: "build",
        runner: { kind: "conversation", agentId: null, model: "gpt-5", mode: null },
      },
      flow,
    });

    expect(runtime.model).toBe("gpt-5");
  });

  it("asks for no extra approvals when the task has no stage", async () => {
    const { context } = createContext();
    const runtime = await resolveTaskRuntime({ context, task: baseTask, flow: null });

    expect(runtime.requireApprovalFor).toEqual([]);
  });
});

describe("ensureProjectTaskConversation", () => {
  it("creates the project conversation before a conversation-owned goal is persisted", async () => {
    const { context, createConversation } = createContext();

    await ensureProjectTaskConversation({
      context,
      task: baseTask,
      conversationId: "task_task-1",
      userId: 7,
    });

    expect(createConversation).toHaveBeenCalledWith("task_task-1", 7, baseTask.objective, {
      project_id: "project-1",
    });
  });
});

describe("task dependencies", () => {
  it("refuses to start a task whose dependency is not done", async () => {
    const blocker = { ...baseTask, id: "task-blocker", status: "running" as ProjectTaskStatus };
    const { context, updateTask } = createContext({
      task: { dependsOnTaskIds: ["task-blocker"] },
      boardTasks: [blocker, { ...baseTask, dependsOnTaskIds: ["task-blocker"] }],
    });

    await expect(startProjectTask(context, "project-1", "task-1")).rejects.toMatchObject({
      statusCode: 409,
    });

    expect(updateTask).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({ status: "blocked", blockedReason: "dependencies_unmet" }),
    );
  });

  it("starts a task once its dependency is done", async () => {
    const blocker = { ...baseTask, id: "task-blocker", status: "done" as ProjectTaskStatus };
    const { context, updateTask } = createContext({
      task: { dependsOnTaskIds: ["task-blocker"] },
      boardTasks: [blocker, { ...baseTask, dependsOnTaskIds: ["task-blocker"] }],
    });

    await startProjectTask(context, "project-1", "task-1");

    expect(updateTask).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({ status: "queued" }),
    );
  });

  it("rejects a task that depends on itself", async () => {
    const { context } = createContext();

    await expect(
      updateProjectTask(context, "project-1", "task-1", { dependsOnTaskIds: ["task-1"] }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("task constraints", () => {
  it("withholds a forbidden tool from the run", async () => {
    const { context } = createContext({
      capabilities: [
        { kind: "tool", capability_id: "web_search" },
        { kind: "tool", capability_id: "run_sandbox_task" },
      ],
    });
    const runtime = await resolveTaskRuntime({
      context,
      task: { ...baseTask, constraints: { forbiddenTools: ["run_sandbox_task"], notes: null } },
      flow: null,
    });

    expect(runtime.enabledTools).not.toContain("run_sandbox_task");
  });

  it("carries a task's own approval policy alongside the stage's", async () => {
    const { context } = createContext();
    const runtime = await resolveTaskRuntime({
      context,
      task: { ...baseTask, requireApprovalFor: ["network"] },
      flow: null,
    });

    expect(runtime.requireApprovalFor).toContain("network");
  });
});
