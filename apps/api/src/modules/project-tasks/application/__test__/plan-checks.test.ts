import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";

import { findMetKillCondition, recordProjectTaskRetrospective } from "../plan-checks";

const tryDecide = vi.hoisted(() => vi.fn());

vi.mock("~/infrastructure/ai", () => ({ ai: { tryDecide } }));

const task = {
  id: "task-1",
  objective: "Ship the pricing page",
  assumptions: [
    { id: "a1", statement: "Customers compare plans before buying" },
    { id: "a2", statement: "Legal signs off within a week" },
  ],
  killConditions: [{ id: "k1", condition: "Legal rules out showing prices publicly" }],
  completions: [],
  retrospective: null,
} as unknown as ProjectTask;

function setup() {
  const updateTask = vi.fn(async () => null);
  const context = {
    env: {},
    user: { id: 7 },
    repositories: fakeRepositories([[ProjectTaskRepository, { updateTask }]]),
  } as unknown as ServiceContext;

  return { context, updateTask };
}

describe("findMetKillCondition", () => {
  beforeEach(() => tryDecide.mockReset());

  it("stops the task only when the evidence clearly meets a condition", async () => {
    const { context } = setup();

    tryDecide.mockResolvedValueOnce({ answers: { condition_1: { noul: 0.92 } } });
    await expect(
      findMetKillCondition(context, task, "Legal: prices cannot be public.", "c-1"),
    ).resolves.toEqual(task.killConditions[0]);

    tryDecide.mockResolvedValueOnce({ answers: { condition_1: { noul: 0.6 } } });
    await expect(findMetKillCondition(context, task, "Unclear.", "c-1")).resolves.toBeNull();
  });

  it("lets the work carry on when no decision model is available", async () => {
    const { context } = setup();

    tryDecide.mockResolvedValueOnce(null);
    await expect(findMetKillCondition(context, task, "Anything.", "c-1")).resolves.toBeNull();
  });
});

describe("recordProjectTaskRetrospective", () => {
  beforeEach(() => tryDecide.mockReset());

  it("records how each assumption held up", async () => {
    const { context, updateTask } = setup();

    tryDecide.mockResolvedValueOnce({
      answers: {
        assumption_1: { choice: "held", probabilities: { held: 0.8, broke: 0.1, unknown: 0.1 } },
        assumption_2: { choice: "broke", probabilities: { held: 0.1, broke: 0.85, unknown: 0.05 } },
      },
    });
    await recordProjectTaskRetrospective(context, task, "done");

    expect(updateTask).toHaveBeenCalledWith("task-1", {
      retrospective: expect.objectContaining({
        finishedAs: "done",
        assumptions: [
          expect.objectContaining({ id: "a1", outcome: "held", confidence: 0.8 }),
          expect.objectContaining({ id: "a2", outcome: "broke", confidence: 0.85 }),
        ],
      }),
    });
  });

  it("marks assumptions unsettled when nothing can judge them, and skips tasks without any", async () => {
    const { context, updateTask } = setup();

    tryDecide.mockResolvedValueOnce(null);
    await recordProjectTaskRetrospective(context, task, "cancelled");
    expect(updateTask).toHaveBeenCalledWith("task-1", {
      retrospective: expect.objectContaining({
        assumptions: [
          expect.objectContaining({ outcome: "unknown", confidence: null }),
          expect.objectContaining({ outcome: "unknown", confidence: null }),
        ],
      }),
    });

    updateTask.mockClear();
    await recordProjectTaskRetrospective(context, { ...task, assumptions: [] }, "done");
    expect(updateTask).not.toHaveBeenCalled();
  });
});
