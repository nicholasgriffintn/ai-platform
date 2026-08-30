import type {
  ProjectTaskCapability,
  ProjectTaskConsequence,
  ProjectTaskEffort,
  ProjectTaskPriority,
  ProjectTaskSource,
  ProjectTaskStatus,
  ToolPermission,
} from "@ngriffin_uk/polychat-schemas";
import {
  permissionsForConsequences,
  PROJECT_TASK_DEFAULT_CAPABILITIES,
  PROJECT_TASK_DEFAULT_CONSEQUENCES,
  PROJECT_TASK_EFFORT_BUDGETS,
} from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { intersectAgentTools, resolveTaskRuntime, toolsWithinCapabilities } from "../flow";
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
  acceptanceCriteria: [],
  deliverable: null,
  context: null,
  constraints: null,
  dependsOnTaskIds: [] as string[],
  requireApprovalFor: [] as ToolPermission[],
  capabilities: [] as ProjectTaskCapability[],
  approvalConsequences: [] as ProjectTaskConsequence[],
  effort: "standard" as ProjectTaskEffort,
  priority: "normal" as ProjectTaskPriority,
  dueAt: null,
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

describe("resolveTaskRuntime", () => {
  const flow = {
    stages: [
      {
        id: "build",
        name: "Build",
        agentId: null,
        skillId: null,
        mode: "build",
        requiresApprovalFor: ["network", "write"] as const,
        advance: "on_human_accept" as const,
      },
    ],
  };

  it("carries the stage approval policy into the run", async () => {
    const { context } = createContext();
    const runtime = await resolveTaskRuntime({
      context,
      task: { ...baseTask, stageId: "build" },
      flow: flow as never,
    });

    expect(runtime.requireApprovalFor).toEqual(["network", "write"]);
    expect(runtime.mode).toBe("build");
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
      flow: flow as never,
    });

    expect(runtime.model).toBe("gpt-5");
  });

  it("asks for no extra approvals when the task has no stage", async () => {
    const { context } = createContext();
    const runtime = await resolveTaskRuntime({ context, task: baseTask, flow: null });

    expect(runtime.requireApprovalFor).toEqual([]);
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

describe("capabilities and consequences", () => {
  const permissions = new Map<string, ToolPermission[]>([
    ["web_search", ["network"]],
    ["run_sandbox_task", ["sandbox"]],
    ["create_note", ["write"]],
    ["search_documents", ["read"]],
  ]);
  const allTools = ["web_search", "run_sandbox_task", "create_note", "search_documents"];

  it("keeps only read-level tools when no capability is granted", () => {
    expect(toolsWithinCapabilities(allTools, [], permissions)).toEqual(["search_documents"]);
  });

  it("admits a tool once its capability is granted", () => {
    expect(toolsWithinCapabilities(allTools, ["web_access"], permissions)).toEqual([
      "web_search",
      "search_documents",
    ]);
  });

  it("turns a consequence into the permissions that gate it", async () => {
    const { context } = createContext();
    const runtime = await resolveTaskRuntime({
      context,
      task: { ...baseTask, approvalConsequences: ["delete"] },
      flow: null,
    });

    expect(runtime.requireApprovalFor).toContain("network");
  });

  it("never asks for approval on reading or reasoning", async () => {
    const { context } = createContext();
    const runtime = await resolveTaskRuntime({
      context,
      task: {
        ...baseTask,
        approvalConsequences: ["publish", "message_people", "spend_money", "delete"],
      },
      flow: null,
    });

    expect(runtime.requireApprovalFor).not.toContain("read");
    expect(runtime.requireApprovalFor).not.toContain("reasoning");
  });
});

describe("effort presets", () => {
  it("resolves a task's budget from its effort rather than a raw number", async () => {
    const { context, updateTask } = createContext({ task: { effort: "quick" } });

    await startProjectTask(context, "project-1", "task-1");

    expect(updateTask).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({ tokenBudget: PROJECT_TASK_EFFORT_BUDGETS.quick }),
    );
  });
});

describe("default capabilities and approvals", () => {
  it("gives a task created without them the safe defaults", async () => {
    const { context } = createContext();
    const createTask = context.repositories.projectTasks.createTask as ReturnType<typeof vi.fn>;

    await createProjectTask(context, "project-1", { objective: "Ship the pricing note" });

    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        capabilities: [...PROJECT_TASK_DEFAULT_CAPABILITIES],
        approvalConsequences: [...PROJECT_TASK_DEFAULT_CONSEQUENCES],
      }),
    );
  });

  it("leaves drafting ungated while every outward consequence is gated", () => {
    const gated = permissionsForConsequences([...PROJECT_TASK_DEFAULT_CONSEQUENCES]);

    expect(gated).not.toContain("read");
    expect(gated).not.toContain("write");
    expect(gated).toContain("network");
  });
});
