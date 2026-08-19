import type { Goal } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  GOAL_CONTINUATION_INSTRUCTION,
  resolveStreamingGoalContinuation,
} from "../goal-continuation";

function createGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: "goal-1",
    conversation_id: "conversation-1",
    sandbox_run_id: null,
    user_id: 1,
    objective: "Make the checkout suite pass",
    status: "active",
    source: "user",
    iteration_count: 0,
    stall_streak: 0,
    tokens_spent: 0,
    progress: [],
    evidence: null,
    stopped_reason: null,
    created_at: "2026-08-19T00:00:00.000Z",
    updated_at: null,
    completed_at: null,
    last_continued_at: null,
    ...overrides,
  };
}

function createContext(goal: Goal | null, planId = "pro") {
  let current = goal;

  return {
    user: { id: 1, plan_id: planId },
    repositories: {
      goals: {
        getActiveGoal: vi.fn(async () => current),
        getGoalById: vi.fn(async () => current),
        updateGoal: vi.fn(async (_id: string, updates: any) => {
          current = {
            ...current,
            ...(updates.status ? { status: updates.status } : {}),
            ...(updates.stallStreak !== undefined ? { stall_streak: updates.stallStreak } : {}),
            ...(updates.iterationCount !== undefined
              ? { iteration_count: updates.iterationCount }
              : {}),
            ...(updates.progress ? { progress: updates.progress } : {}),
          };

          return current;
        }),
        createGoal: vi.fn(),
        listGoals: vi.fn(),
      },
    },
  } as any;
}

describe("resolveStreamingGoalContinuation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps a streaming turn working while the goal is unsatisfied", async () => {
    const result = await resolveStreamingGoalContinuation({
      completionId: "conversation-1",
      context: createContext(createGoal()),
      summary: "Here is a summary of what I found",
      producedEvidence: true,
    });

    expect(result).toEqual({ instruction: GOAL_CONTINUATION_INSTRUCTION });
  });

  it("stops once the goal stops producing evidence", async () => {
    const context = createContext(createGoal({ stall_streak: 1 }));

    const result = await resolveStreamingGoalContinuation({
      completionId: "conversation-1",
      context,
      summary: "Same answer as before",
      producedEvidence: false,
    });

    expect(result).toBeNull();
    expect(context.repositories.goals.updateGoal).toHaveBeenCalledWith(
      "goal-1",
      expect.objectContaining({ status: "stalled" }),
    );
  });

  it("does nothing without an active goal", async () => {
    await expect(
      resolveStreamingGoalContinuation({
        completionId: "conversation-1",
        context: createContext(null),
        summary: "done",
        producedEvidence: true,
      }),
    ).resolves.toBeNull();

    await expect(
      resolveStreamingGoalContinuation({
        completionId: "conversation-1",
        context: createContext(createGoal({ status: "paused" })),
        summary: "done",
        producedEvidence: true,
      }),
    ).resolves.toBeNull();
  });

  it("does nothing for a user without Pro", async () => {
    await expect(
      resolveStreamingGoalContinuation({
        completionId: "conversation-1",
        context: createContext(createGoal(), "free"),
        summary: "done",
        producedEvidence: true,
      }),
    ).resolves.toBeNull();
  });
});
