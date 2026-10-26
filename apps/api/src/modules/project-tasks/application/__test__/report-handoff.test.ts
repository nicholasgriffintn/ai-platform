import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { enqueueTeammateWake } from "~/modules/teammates/application/wakes";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import { WorkspaceTeammateRepository } from "~/modules/teammates/infrastructure/WorkspaceTeammateRepository";

import { getPendingProjectTaskQuestions } from "../questions";
import { handBlockedTaskToManager } from "../report-handoff";

vi.mock("~/modules/teammates/application/wakes", () => ({ enqueueTeammateWake: vi.fn() }));
vi.mock("../questions", () => ({ getPendingProjectTaskQuestions: vi.fn() }));

function blockedTask(overrides: Partial<ProjectTask> = {}): ProjectTask {
  return {
    id: "task-1",
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
    owner: { type: "teammate", id: "coordinator" },
    reviewer: null,
    details: {},
    objective: "Document the operating baseline",
    acceptanceCriteria: [],
    assumptions: [],
    killConditions: [],
    retrospective: null,
    expectedOutput: null,
    context: null,
    constraints: null,
    dependsOnTaskIds: [],
    requireApprovalFor: [],
    status: "blocked",
    source: "user",
    blockedReason: "awaiting_input",
    blockedDetail: null,
    stageId: null,
    runner: null,
    createdByUserId: 7,
    assigneeUserId: null,
    runnerIdentityUserId: 7,
    conversationId: "task_task-1",
    originConversationId: null,
    goalId: null,
    dispatchTaskId: null,
    completions: [],
    position: 1000,
    tokenBudget: null,
    tokensSpent: 0,
    createdAt: "2026-10-26T08:00:00.000Z",
    updatedAt: null,
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

function context(
  team: { teammateId: string; reportsToTeammateId: string | null; status: string }[] = [
    { teammateId: "coordinator", reportsToTeammateId: "lead", status: "active" },
    { teammateId: "lead", reportsToTeammateId: null, status: "active" },
  ],
): ServiceContext {
  return Object.assign(Object.create(null), {
    env: {},
    requireUser: vi.fn().mockReturnValue({ id: 7 }),
    repositories: fakeRepositories([
      [WorkspaceTeammateRepository, { listForWorkspace: vi.fn().mockResolvedValue(team) }],
      [ProjectTaskRepository, { updateTask: vi.fn().mockResolvedValue(null) }],
      [
        TeammateRepository,
        { getTeammateById: vi.fn().mockResolvedValue({ id: "coordinator", name: "Coordinator" }) },
      ],
    ]),
  });
}

describe("handing a report's blocked task to its manager", () => {
  beforeEach(() => {
    vi.mocked(enqueueTeammateWake).mockReset().mockResolvedValue(true);
    vi.mocked(getPendingProjectTaskQuestions)
      .mockReset()
      .mockResolvedValue({
        interactionId: "interaction-1",
        requestedAt: "2026-10-26T08:00:00.000Z",
        questions: [
          {
            id: "trading-days",
            prompt: "Which days does the bakery trade?",
            options: [],
            allowOther: true,
          },
        ],
      });
  });

  it("wakes the manager with the pending questions instead of asking people", async () => {
    const serviceContext = context();

    await expect(
      handBlockedTaskToManager(serviceContext, blockedTask({ attentionVersion: 4 })),
    ).resolves.toBe(true);

    expect(serviceContext.repositories.get(ProjectTaskRepository).updateTask).toHaveBeenCalledWith(
      "task-1",
      { details: { handoff: { teammateId: "lead", version: 4 } } },
    );

    expect(enqueueTeammateWake).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        teammateId: "lead",
        reason: "report_blocked",
        taskId: "task-1",
        detail: expect.stringContaining("[trading-days] Which days does the bakery trade?"),
      }),
    );
  });

  it("leaves approvals and escalations to people", async () => {
    await expect(
      handBlockedTaskToManager(context(), blockedTask({ blockedReason: "awaiting_approval" })),
    ).resolves.toBe(false);
    await expect(
      handBlockedTaskToManager(
        context(),
        blockedTask({
          details: {
            escalation: {
              to: { type: "person", userId: 7 },
              reason: "Needs trading days",
              by: { type: "teammate", id: "lead" },
              at: "2026-10-26T08:05:00.000Z",
            },
          },
        }),
      ),
    ).resolves.toBe(false);
    expect(enqueueTeammateWake).not.toHaveBeenCalled();
  });

  it("asks people when the owner has no active teammate manager", async () => {
    await expect(
      handBlockedTaskToManager(
        context([
          { teammateId: "coordinator", reportsToTeammateId: "lead", status: "active" },
          { teammateId: "lead", reportsToTeammateId: null, status: "paused" },
        ]),
        blockedTask(),
      ),
    ).resolves.toBe(false);
    await expect(
      handBlockedTaskToManager(
        context([{ teammateId: "coordinator", reportsToTeammateId: null, status: "active" }]),
        blockedTask(),
      ),
    ).resolves.toBe(false);
    expect(enqueueTeammateWake).not.toHaveBeenCalled();
  });
});
