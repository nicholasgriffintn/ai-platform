import type { ProjectTask, TaskBreakdown } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { managesTeammate } from "~/modules/teammates/application/organisation";

import { acceptTaskBreakdown, proposeTaskBreakdown } from "../breakdown";
import { createProjectTask } from "../index";
import { requireTaskInProject, wakeTeammateOnTask } from "../work";

vi.mock("../index", () => ({ assertParentAllowed: vi.fn(), createProjectTask: vi.fn() }));
vi.mock("../work", () => ({
  postEvent: vi.fn(),
  requireTaskInProject: vi.fn(),
  wakeTeammateOnTask: vi.fn(),
}));
vi.mock("~/modules/teammates/application/organisation", () => ({
  managesTeammate: vi.fn(),
  resolveManager: vi.fn().mockResolvedValue({ type: "person", userId: 7 }),
}));
vi.mock("~/modules/teammates/application/wakes", () => ({ enqueueTeammateWake: vi.fn() }));

const coordinator = { type: "teammate" as const, id: "coordinator" };
const lead = {
  actor: { type: "teammate" as const, id: "lead" },
  author: { kind: "teammate" as const, name: "Lead", userId: null, teammateId: "lead" },
};
const owner = {
  actor: coordinator,
  author: {
    kind: "teammate" as const,
    name: "Coordinator",
    userId: null,
    teammateId: "coordinator",
  },
};

function parent(breakdown?: TaskBreakdown): ProjectTask {
  return {
    id: "menu-1",
    projectId: "project-1",
    workspaceId: "workspace-1",
    key: "MENU-1",
    number: 1,
    kind: "task",
    description: null,
    priority: "high",
    parentTaskId: null,
    startAt: null,
    dueAt: null,
    owner: coordinator,
    reviewer: null,
    details: breakdown ? { breakdown } : {},
    objective: "Plan the first weekly menu",
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
    runnerIdentityUserId: 7,
    conversationId: null,
    originConversationId: null,
    goalId: null,
    dispatchTaskId: null,
    completions: [],
    position: 1000,
    tokenBudget: null,
    tokensSpent: 0,
    createdAt: "2026-10-27T08:00:00.000Z",
    updatedAt: null,
    startedAt: null,
    completedAt: null,
  };
}

const proposed: TaskBreakdown = {
  revision: 2,
  items: [
    {
      key: "draft",
      objective: "Draft quantities",
      owner: coordinator,
      dependsOn: ["baseline"],
      priority: "medium",
    },
    {
      key: "baseline",
      objective: "Record the baseline",
      owner: null,
      dependsOn: [],
      priority: "high",
    },
  ],
  proposedBy: coordinator,
  proposedAt: "2026-10-27T08:05:00.000Z",
  acceptedBy: null,
  acceptedAt: null,
  taskIds: {},
};

describe("task breakdowns", () => {
  const updateTask = vi.fn();
  let context: ServiceContext;

  beforeEach(() => {
    vi.clearAllMocks();
    updateTask.mockImplementation(async (_id: string, changes: Partial<ProjectTask>) => ({
      ...parent(proposed),
      ...changes,
    }));
    vi.mocked(createProjectTask).mockImplementation(async (_context, _projectId, input) => ({
      task: { ...parent(), id: `child-${input.objective}`, owner: input.owner ?? null },
    }));
    context = Object.assign(Object.create(null), {
      requireUser: vi.fn().mockReturnValue({ id: 7 }),
      repositories: fakeRepositories([
        [
          ProjectTaskRepository,
          { getTaskById: vi.fn().mockResolvedValue(null), updateTask, deleteTask: vi.fn() },
        ],
      ]),
    });
  });

  it("rejects sub-tasks that wait on each other in a loop", async () => {
    vi.mocked(requireTaskInProject).mockResolvedValue(parent());

    await expect(
      proposeTaskBreakdown(
        context,
        "project-1",
        "MENU-1",
        [
          { key: "a", objective: "A", owner: null, dependsOn: ["b"], priority: "medium" },
          { key: "b", objective: "B", owner: null, dependsOn: ["a"], priority: "medium" },
        ],
        owner,
      ),
    ).rejects.toThrow("wait on each other in a loop");
    expect(updateTask).not.toHaveBeenCalled();
  });

  it("creates the sub-tasks in dependency order with their blockers once a manager accepts", async () => {
    vi.mocked(requireTaskInProject).mockResolvedValue(parent(proposed));
    vi.mocked(managesTeammate).mockResolvedValue(true);

    await acceptTaskBreakdown(context, "project-1", "MENU-1", 2, lead);

    expect(vi.mocked(createProjectTask).mock.calls.map(([, , input]) => input)).toEqual([
      expect.objectContaining({ objective: "Record the baseline", dependsOnTaskIds: [] }),
      expect.objectContaining({
        objective: "Draft quantities",
        parentTaskId: "menu-1",
        dependsOnTaskIds: ["child-Record the baseline"],
      }),
    ]);
    expect(wakeTeammateOnTask).toHaveBeenCalledTimes(1);
    expect(updateTask.mock.calls[0]?.[1].details.breakdown).toMatchObject({
      acceptedBy: lead.actor,
      taskIds: { baseline: "child-Record the baseline", draft: "child-Draft quantities" },
    });
  });

  it("does not let the owner accept its own breakdown", async () => {
    vi.mocked(requireTaskInProject).mockResolvedValue(parent(proposed));

    await expect(acceptTaskBreakdown(context, "project-1", "MENU-1", 2, owner)).rejects.toThrow(
      "Only the owner's manager or a person can accept a breakdown",
    );
    expect(createProjectTask).not.toHaveBeenCalled();
  });
});
