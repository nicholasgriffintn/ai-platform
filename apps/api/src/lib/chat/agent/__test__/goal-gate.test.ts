import { describe, expect, it, vi } from "vitest";

import { createGoalFinishGate } from "../goal-gate";

function buildGate(recordIteration: ReturnType<typeof vi.fn>, onTerminalStatus?: any) {
  const goal = {
    id: "goal-1",
    conversation_id: "conv-1",
    sandbox_run_id: null,
    status: "active",
    iteration_count: 0,
  } as never;

  const goalService = {
    getActiveGoal: vi.fn().mockResolvedValue(goal),
    recordIteration,
  } as never;

  return createGoalFinishGate({ goalService, goal, surface: "chat", onTerminalStatus });
}

describe("createGoalFinishGate", () => {
  it("counts a turn as progress from new commands, not against the growing iteration count", async () => {
    const recordIteration = vi.fn().mockImplementation(({ goal }) =>
      Promise.resolve({
        goal: { ...goal, iteration_count: goal.iteration_count + 1 },
        shouldContinue: true,
      }),
    );
    const gate = buildGate(recordIteration);

    await gate({ summary: "used a tool", step: 1, commandCount: 1 });
    await gate({ summary: "used another tool", step: 2, commandCount: 2 });

    expect(recordIteration.mock.calls[0][0].iteration).toMatchObject({
      producedEvidence: true,
      calledTool: true,
    });
    expect(recordIteration.mock.calls[1][0].iteration).toMatchObject({
      producedEvidence: true,
      calledTool: true,
    });
  });

  it("marks a goal completed elsewhere once, at the end of the turn", async () => {
    const goal = {
      id: "goal-1",
      conversation_id: "conv-1",
      sandbox_run_id: null,
      status: "active",
      iteration_count: 1,
    } as never;
    const onTerminalStatus = vi.fn();
    const goalService = {
      getActiveGoal: vi.fn().mockResolvedValue(null),
      getGoalById: vi.fn().mockResolvedValue({ ...(goal as any), status: "completed" }),
      recordIteration: vi.fn(),
    } as never;

    const gate = createGoalFinishGate({
      goalService,
      goal,
      surface: "chat",
      onTerminalStatus,
    });

    const first = await gate({ summary: "done", step: 1, commandCount: 1 });

    await gate({ summary: "done again", step: 2, commandCount: 1 });

    expect(first).toMatchObject({ allow: true, outcome: "satisfied" });
    expect(onTerminalStatus).toHaveBeenCalledTimes(1);
  });

  it("counts new prose as progress but a repeated answer as a stall", async () => {
    const recordIteration = vi
      .fn()
      .mockImplementation(({ goal }) => Promise.resolve({ goal, shouldContinue: true }));
    const gate = buildGate(recordIteration);

    await gate({ summary: "10, 20", step: 1, commandCount: 0 });
    await gate({ summary: "30, 40", step: 2, commandCount: 0 });
    await gate({ summary: "30, 40", step: 3, commandCount: 0 });

    expect(recordIteration.mock.calls.map((call) => call[0].iteration.producedEvidence)).toEqual([
      true,
      true,
      false,
    ]);
  });
});
