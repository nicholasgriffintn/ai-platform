import { createSequentialProjectFlow } from "@ngriffin_uk/polychat-schemas";
import type { ProjectFlow, ProjectTaskStatus } from "@ngriffin_uk/polychat-schemas";
import { intersectEnabledTools } from "@ngriffin_uk/polychat-utility-server/enabled-tools";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Teammate } from "~/infrastructure/database/schema";

import {
  createProjectTaskTestContext as createContext,
  disposeProjectTaskTestRuntime,
} from "../../../../../test/project-task-context";
import { projectTaskFixture } from "../../../../../test/project-task-fixtures";
import { resolveProjectTaskToolApproval } from "../approvals";
import { buildNodeInstructions, resolveTaskRuntime } from "../flow";
import {
  createProjectTask,
  deleteProjectTask,
  setProjectFlow,
  startProjectTask,
  respondToProjectTaskToolApproval,
  updateProjectTask,
} from "../index";
import {
  buildTaskRunMessages,
  ensureProjectTaskConversation,
  queueProjectTaskRun,
} from "../runner";

const baseTask = projectTaskFixture();

vi.mock("../runner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../runner")>();

  return {
    ...actual,
    queueProjectTaskRun: vi
      .fn()
      .mockImplementation(async ({ context, task, runnerIdentityUserId, nodeId }) =>
        context.repositories.projectTasks.updateTask(task.id, {
          status: "queued",
          runnerIdentityUserId,
          nodeId: nodeId ?? task.nodeId,
        }),
      ),
  };
});

vi.mock("../approvals", () => ({
  resolveProjectTaskToolApproval: vi.fn(),
}));

afterAll(disposeProjectTaskTestRuntime);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveProjectTaskToolApproval).mockResolvedValue({
    toolName: "use_recipe_connector",
    resolution: "approved",
  });
});

describe("buildTaskRunMessages", () => {
  it("keeps the conversation history when a task resumes", () => {
    const history = [
      { id: "question", role: "tool" as const, content: "Waiting for answers" },
      { id: "answer", role: "user" as const, content: "Audience: Developers" },
    ];

    expect(buildTaskRunMessages(history, "Continue the project task")).toEqual([
      ...history,
      { role: "user", content: "Continue the project task" },
    ]);
  });
});

describe("createProjectTask", () => {
  it("rejects an assignee who is not a member of the workspace", async () => {
    const { context } = await createContext({ memberships: { 7: true } });

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
    const { context } = await createContext({ task: { status: "review" } });

    await expect(
      updateProjectTask(context, "project-1", "task-1", { status: "done" }, { actor: "model" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("does not rewrite plan inputs after execution has started", async () => {
    const { context, updateTask } = await createContext({
      task: { status: "blocked" },
    });

    await expect(
      updateProjectTask(context, "project-1", "task-1", {
        objective: "Changed objective",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(updateTask).not.toHaveBeenCalled();
  });

  it("does not reopen an abandoned plan that already has execution evidence", async () => {
    const { context, updateTask } = await createContext({
      task: { status: "cancelled", runId: "run-1" },
    });

    await expect(
      updateProjectTask(context, "project-1", "task-1", { status: "backlog" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(updateTask).not.toHaveBeenCalled();
  });

  it("does not reopen a completed plan that already has execution evidence", async () => {
    const { context, updateTask } = await createContext({
      task: { status: "done", runId: "run-1" },
    });

    await expect(
      updateProjectTask(context, "project-1", "task-1", { status: "backlog" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(updateTask).not.toHaveBeenCalled();
  });
});

describe("startProjectTask", () => {
  it("refuses to start work when the project is already at its concurrency cap", async () => {
    const { context } = await createContext({ activeCount: 3 });

    await expect(startProjectTask(context, "project-1", "task-1")).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("requires the pending approval response instead of treating a retry as approval", async () => {
    const { context } = await createContext({
      task: { status: "blocked", blockedReason: "awaiting_approval" },
    });

    await expect(startProjectTask(context, "project-1", "task-1")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(queueProjectTaskRun).not.toHaveBeenCalled();
  });

  it("resumes with only the approved tool authorised for the next run", async () => {
    const { context } = await createContext({
      task: { status: "blocked", blockedReason: "awaiting_approval" },
    });

    await respondToProjectTaskToolApproval(context, "project-1", "task-1", {
      interactionId: "approval-1",
      resolution: "approved",
    });

    expect(queueProjectTaskRun).toHaveBeenCalledWith(
      expect.objectContaining({ approvedTools: ["use_recipe_connector"] }),
    );
  });

  it("checks current workspace membership before resolving an approval", async () => {
    const { context } = await createContext({
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

  it("refuses a blind retry after an external operation approval was consumed", async () => {
    const { context } = await createContext({
      task: { status: "blocked", blockedReason: "run_failed", runId: "run-1" },
    });

    vi.mocked(
      context.repositories.connectorOperationApprovals.listConsumedRunIds,
    ).mockResolvedValue(new Set(["run-1"]));

    await expect(startProjectTask(context, "project-1", "task-1")).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("Reconcile the provider"),
    });
    expect(queueProjectTaskRun).not.toHaveBeenCalled();
  });
});

describe("deleteProjectTask", () => {
  it("retains a task once it has execution evidence", async () => {
    const { context } = await createContext({
      task: { status: "blocked", runId: "run-1" },
    });

    await expect(deleteProjectTask(context, "project-1", "task-1")).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe("setProjectFlow", () => {
  it("refuses a stage naming an teammate the project has not attached", async () => {
    const { context } = await createContext({ capabilities: [] });

    await expect(
      setProjectFlow(
        context,
        "project-1",
        createSequentialProjectFlow(
          [
            {
              id: "build",
              name: "Build",
              instructions: null,
              teammateId: "teammate-1",
              skillIds: [],
              mode: null,
              requiresApprovalFor: [],
            },
          ],
          [],
        ),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("accepts multiple skills when every one is attached to the project", async () => {
    const { context } = await createContext({
      capabilities: [
        { kind: "skill", capability_id: "research" },
        { kind: "skill", capability_id: "fact-checking" },
      ],
    });
    const flow: ProjectFlow = createSequentialProjectFlow(
      [
        {
          id: "research",
          name: "Research",
          instructions: null,
          teammateId: null,
          skillIds: ["research", "fact-checking"],
          mode: "explore",
          requiresApprovalFor: [],
        },
      ],
      [],
    );

    await expect(setProjectFlow(context, "project-1", flow)).resolves.toEqual({
      flow,
      triggerStates: [],
    });
  });
});

describe("intersectEnabledTools", () => {
  it("narrows an teammate's tools to the project's rather than widening them", () => {
    expect(intersectEnabledTools(["web_search"], ["web_search", "run_sandbox_task"])).toEqual([
      "web_search",
    ]);
  });

  it("gives an teammate with no declared tools exactly the project's tools", () => {
    expect(intersectEnabledTools(["web_search"], null)).toEqual(["web_search"]);
  });
});

describe("resolveTaskRuntime", () => {
  const flow: ProjectFlow = createSequentialProjectFlow(
    [
      {
        id: "build",
        name: "Build",
        instructions: null,
        teammateId: null,
        skillIds: [],
        mode: "build",
        requiresApprovalFor: ["network", "write"],
      },
    ],
    ["build"],
  );

  it("carries the stage approval policy into the run", async () => {
    const { context } = await createContext();
    const runtime = await resolveTaskRuntime({
      context,
      task: { ...baseTask, nodeId: "build" },
      flow,
    });

    expect(runtime.requireApprovalFor).toEqual(["network", "write"]);
    expect(runtime.mode).toBe("build");
    expect(runtime.enabledTools).toEqual(
      expect.arrayContaining(["get_task", "list_tasks", "update_task"]),
    );
  });

  it("keeps the runner model when the stage sets a mode", async () => {
    const { context } = await createContext();
    const runtime = await resolveTaskRuntime({
      context,
      task: {
        ...baseTask,
        nodeId: "build",
        runner: {
          kind: "conversation",
          teammateId: null,
          model: "gpt-5",
          mode: null,
        },
      },
      flow,
    });

    expect(runtime.model).toBe("gpt-5");
  });

  it("gives a coding project's task the sandbox tool", async () => {
    const { context } = await createContext({
      project: {
        coding_enabled: 1,
        coding_installation_id: 4242,
        coding_repository: "nicholasgriffintn/polychat",
      },
    });
    const runtime = await resolveTaskRuntime({
      context,
      task: baseTask,
      flow: null,
    });

    expect(runtime.enabledTools).toContain("run_sandbox_task");
  });

  it("withholds the sandbox tool when the project has no coding environment", async () => {
    const { context } = await createContext();
    const runtime = await resolveTaskRuntime({
      context,
      task: baseTask,
      flow: null,
    });

    expect(runtime.enabledTools).not.toContain("run_sandbox_task");
  });

  it("lets a task forbid the sandbox tool its coding project offers", async () => {
    const { context } = await createContext({
      project: {
        coding_enabled: 1,
        coding_installation_id: 4242,
        coding_repository: "nicholasgriffintn/polychat",
      },
    });
    const runtime = await resolveTaskRuntime({
      context,
      task: {
        ...baseTask,
        constraints: { forbiddenTools: ["run_sandbox_task"], notes: "" },
      },
      flow: null,
    });

    expect(runtime.enabledTools).not.toContain("run_sandbox_task");
  });

  it("asks for no extra approvals when the task has no stage", async () => {
    const { context } = await createContext();
    const runtime = await resolveTaskRuntime({
      context,
      task: baseTask,
      flow: null,
    });

    expect(runtime.requireApprovalFor).toEqual([]);
  });

  it("runs an attached teammate the project's workspace owns", async () => {
    const { context } = await createContext({
      capabilities: [{ kind: "teammate", capability_id: "teammate-1" }],
      teammate: {
        id: "teammate-1",
        user_id: 7,
        owner_scope_type: "workspace",
        owner_scope_id: "workspace-1",
        enabled_tools: null,
        model: "gpt-5",
      },
    });

    const runtime = await resolveTaskRuntime({
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
    });

    expect(runtime.teammate?.id).toBe("teammate-1");
  });

  it("gives a platform teammate its own tools and skills inside a project", async () => {
    const { context } = await createContext({
      teammate: {
        id: "platform-research",
        user_id: -1,
        owner_scope_type: "platform",
        owner_scope_id: "platform",
        enabled_tools: ["search_documents", "create_note"],
        skill_ids: ["document-research"],
        model: null,
      },
    });

    const runtime = await resolveTaskRuntime({
      context,
      task: {
        ...baseTask,
        runner: {
          kind: "conversation",
          teammateId: "platform-research",
          model: null,
          mode: null,
        },
      },
      flow: null,
    });

    expect(runtime.enabledTools).toEqual(
      expect.arrayContaining(["search_documents", "create_note"]),
    );
    expect(runtime.skillIds).toEqual(["document-research"]);
  });

  it("refuses an attached teammate that now belongs to another workspace", async () => {
    const { context } = await createContext({
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

  const workspaceTeammate = {
    id: "teammate-1",
    user_id: 7,
    owner_scope_type: "workspace",
    owner_scope_id: "workspace-1",
    enabled_tools: null,
  } satisfies Partial<Teammate>;
  const teammateRunner = {
    kind: "conversation" as const,
    teammateId: "teammate-1",
    model: null,
    mode: null,
  };

  it("withholds a skill the teammate asks for but the project has not attached", async () => {
    const { context } = await createContext({
      capabilities: [
        { kind: "teammate", capability_id: "teammate-1" },
        { kind: "skill", capability_id: "research" },
      ],
      teammate: {
        ...workspaceTeammate,
        skill_ids: ["research", "payroll-export"],
      },
    });

    const runtime = await resolveTaskRuntime({
      context,
      task: { ...baseTask, runner: teammateRunner },
      flow: null,
    });

    expect(runtime.skillIds).toEqual(["research"]);
  });

  it("combines the stage's skills with the teammate's inside the project grant", async () => {
    const { context } = await createContext({
      capabilities: [
        { kind: "teammate", capability_id: "teammate-1" },
        { kind: "skill", capability_id: "research" },
        { kind: "skill", capability_id: "fact-checking" },
      ],
      teammate: {
        ...workspaceTeammate,
        skill_ids: ["fact-checking", "payroll-export"],
      },
    });

    const runtime = await resolveTaskRuntime({
      context,
      task: { ...baseTask, nodeId: "research", runner: teammateRunner },
      flow: createSequentialProjectFlow(
        [
          {
            id: "research",
            name: "Research",
            instructions: null,
            teammateId: null,
            skillIds: ["research"],
            mode: "explore",
            requiresApprovalFor: [],
          },
        ],
        [],
      ),
    });

    expect(runtime.skillIds).toEqual(["research", "fact-checking"]);
    expect(buildNodeInstructions(runtime)).toContain("research, fact-checking");
  });

  it("lets the stage mode beat the teammate's saved mode", async () => {
    const { context } = await createContext({
      capabilities: [{ kind: "teammate", capability_id: "teammate-1" }],
      teammate: { ...workspaceTeammate, mode: "plan" },
    });

    const runtime = await resolveTaskRuntime({
      context,
      task: { ...baseTask, nodeId: "build", runner: teammateRunner },
      flow,
    });

    expect(runtime.mode).toBe("build");
  });

  it("falls back to the teammate's saved mode when neither the stage nor the runner sets one", async () => {
    const { context } = await createContext({
      capabilities: [{ kind: "teammate", capability_id: "teammate-1" }],
      teammate: { ...workspaceTeammate, mode: "plan" },
    });

    const runtime = await resolveTaskRuntime({
      context,
      task: { ...baseTask, runner: teammateRunner },
      flow: null,
    });

    expect(runtime.mode).toBe("plan");
  });

  it("refuses a personal attached teammate whose author left the workspace", async () => {
    const { context } = await createContext({
      capabilities: [{ kind: "teammate", capability_id: "teammate-1" }],
      memberships: { 7: true },
      teammate: {
        id: "teammate-1",
        user_id: 9,
        owner_scope_type: "user",
        owner_scope_id: "9",
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

describe("ensureProjectTaskConversation", () => {
  it("creates the project conversation before a conversation-owned goal is persisted", async () => {
    const { context, createConversation } = await createContext();

    await ensureProjectTaskConversation({
      context,
      task: baseTask,
      conversationId: "task_task-1",
      userId: 7,
    });

    expect(createConversation).toHaveBeenCalledWith("task_task-1", 7, baseTask.objective, {
      project_id: "project-1",
      type: "task",
    });
  });
});

describe("task dependencies", () => {
  it("refuses to start a task whose dependency is not done", async () => {
    const blocker = {
      ...baseTask,
      id: "task-blocker",
      status: "running" as ProjectTaskStatus,
    };
    const { context } = await createContext({
      task: { dependsOnTaskIds: ["task-blocker"] },
      boardTasks: [blocker, { ...baseTask, dependsOnTaskIds: ["task-blocker"] }],
    });

    await expect(startProjectTask(context, "project-1", "task-1")).rejects.toMatchObject({
      statusCode: 409,
    });

    expect(queueProjectTaskRun).not.toHaveBeenCalled();
  });

  it("rejects a task that depends on itself", async () => {
    const { context } = await createContext();

    await expect(
      updateProjectTask(context, "project-1", "task-1", {
        dependsOnTaskIds: ["task-1"],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("task constraints", () => {
  it("withholds a forbidden tool from the run", async () => {
    const { context } = await createContext({
      capabilities: [
        { kind: "tool", capability_id: "web_search" },
        { kind: "tool", capability_id: "run_sandbox_task" },
      ],
    });
    const runtime = await resolveTaskRuntime({
      context,
      task: {
        ...baseTask,
        constraints: { forbiddenTools: ["run_sandbox_task"], notes: null },
      },
      flow: null,
    });

    expect(runtime.enabledTools).not.toContain("run_sandbox_task");
  });

  it("carries a task's own approval policy alongside the stage's", async () => {
    const { context } = await createContext();
    const runtime = await resolveTaskRuntime({
      context,
      task: { ...baseTask, requireApprovalFor: ["network"] },
      flow: null,
    });

    expect(runtime.requireApprovalFor).toContain("network");
  });
});
