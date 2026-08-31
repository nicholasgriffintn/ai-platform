import type { Goal } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { createGoalFinishGate } from "../goal-gate";

function createGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: "goal-1",
    conversation_id: "conv-1",
    sandbox_run_id: null,
    user_id: 1,
    objective: "Create the requested artefacts",
    status: "active",
    source: "model",
    iteration_count: 0,
    stall_streak: 0,
    tokens_spent: 0,
    progress: [],
    evidence: null,
    stopped_reason: null,
    created_at: "2026-08-30T00:00:00.000Z",
    updated_at: null,
    completed_at: null,
    last_continued_at: null,
    ...overrides,
  };
}

function createGate(options: {
  goal?: Goal | null;
  recordIteration?: ReturnType<typeof vi.fn>;
  onTerminalStatus?: (goal: Goal) => Promise<void>;
}) {
  const recordIteration =
    options.recordIteration ??
    vi.fn(async ({ goalId }) => ({
      goal: createGoal({ id: goalId, iteration_count: 1 }),
      shouldContinue: true,
      transitioned: false,
    }));

  return {
    gate: createGoalFinishGate({
      goalService: { recordIteration } as never,
      goal: options.goal,
      surface: "chat",
      onTerminalStatus: options.onTerminalStatus,
    }),
    recordIteration,
  };
}

describe("createGoalFinishGate", () => {
  it("adopts a goal from the successful set_goal result without querying for a latest goal", async () => {
    const goal = createGoal();
    const { gate, recordIteration } = createGate({ goal: null });

    await gate.observeToolResult({
      role: "tool",
      name: "set_goal",
      status: "success",
      content: "Goal set",
      data: { goal },
    });

    const result = await gate.assessFinish({
      summary: "Artefacts produced",
      step: 2,
      commandCount: 1,
    });

    expect(recordIteration).toHaveBeenCalledWith(expect.objectContaining({ goalId: goal.id }));
    expect(result).toMatchObject({ allow: false });
  });

  it("accepts a successful complete_goal result and reports its terminal transition once", async () => {
    const onTerminalStatus = vi.fn(async () => undefined);
    const { gate, recordIteration } = createGate({
      goal: createGoal(),
      onTerminalStatus,
    });
    const completed = createGoal({ status: "completed" });

    await gate.observeToolResult({
      role: "tool",
      name: "complete_goal",
      status: "success",
      content: "Goal completed",
      data: { goal: completed },
    });

    const result = await gate.assessFinish({ summary: "Done", step: 3, commandCount: 2 });

    expect(result).toEqual({ allow: true, outcome: "satisfied" });
    expect(recordIteration).not.toHaveBeenCalled();
    expect(onTerminalStatus).toHaveBeenCalledOnce();
    expect(onTerminalStatus).toHaveBeenCalledWith(completed);
  });

  it("does not report a paused goal as terminal", async () => {
    const onTerminalStatus = vi.fn(async () => undefined);
    const { gate, recordIteration } = createGate({
      goal: createGoal({ status: "paused" }),
      onTerminalStatus,
    });

    const result = await gate.assessFinish({ summary: "Paused", step: 1, commandCount: 0 });

    expect(result).toEqual({ allow: true, outcome: "unsatisfied" });
    expect(recordIteration).not.toHaveBeenCalled();
    expect(onTerminalStatus).not.toHaveBeenCalled();
  });

  it("counts progress from new commands, not the growing iteration count", async () => {
    const recordIteration = vi
      .fn()
      .mockResolvedValueOnce({
        goal: createGoal({ iteration_count: 1 }),
        shouldContinue: true,
        transitioned: false,
      })
      .mockResolvedValueOnce({
        goal: createGoal({ iteration_count: 2 }),
        shouldContinue: true,
        transitioned: false,
      });
    const { gate } = createGate({ goal: createGoal(), recordIteration });

    await gate.assessFinish({ summary: "used a tool", step: 1, commandCount: 1 });
    await gate.assessFinish({ summary: "used another tool", step: 2, commandCount: 2 });

    expect(recordIteration.mock.calls[0][0].iteration).toMatchObject({
      producedEvidence: true,
      calledTool: true,
    });
    expect(recordIteration.mock.calls[1][0].iteration).toMatchObject({
      producedEvidence: true,
      calledTool: true,
    });
  });

  it("reports a terminal status only when recording the iteration caused the transition", async () => {
    const stalled = createGoal({ status: "stalled" });
    const recordIteration = vi.fn().mockResolvedValue({
      goal: stalled,
      shouldContinue: false,
      transitioned: true,
    });
    const onTerminalStatus = vi.fn(async () => undefined);
    const { gate } = createGate({ goal: createGoal(), recordIteration, onTerminalStatus });

    const result = await gate.assessFinish({ summary: "No progress", step: 2, commandCount: 0 });

    expect(result).toEqual({ allow: true, outcome: "stalled" });
    expect(onTerminalStatus).toHaveBeenCalledWith(stalled);
  });
});
