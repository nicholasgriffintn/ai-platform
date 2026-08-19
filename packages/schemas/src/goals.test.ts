import { describe, expect, it } from "vitest";

import {
  evaluateGoalContinuation,
  GOAL_STALL_THRESHOLD,
  isTerminalGoalStatus,
  type GoalContinuationInput,
} from "./goals";

function input(overrides: Partial<GoalContinuationInput> = {}): GoalContinuationInput {
  return {
    goal: { status: "active", stall_streak: 0 },
    lastTurn: {
      producedEvidence: true,
      calledTool: true,
      aborted: false,
      awaitingApproval: false,
    },
    usageLimitsExhausted: false,
    queuedInstructionCount: 0,
    otherWorkInFlight: false,
    ...overrides,
  };
}

describe("evaluateGoalContinuation", () => {
  it("keeps going while the work produces evidence, however many turns that takes", () => {
    let streak = 0;

    for (let turn = 0; turn < 50; turn += 1) {
      const decision = evaluateGoalContinuation(
        input({ goal: { status: "active", stall_streak: streak } }),
      );

      expect(decision.shouldContinue).toBe(true);
      streak = decision.nextStallStreak;
    }

    expect(streak).toBe(0);
  });

  it("stops after consecutive turns that produce nothing new", () => {
    const first = evaluateGoalContinuation(
      input({
        goal: { status: "active", stall_streak: 0 },
        lastTurn: {
          producedEvidence: false,
          calledTool: false,
          aborted: false,
          awaitingApproval: false,
        },
      }),
    );

    expect(first.shouldContinue).toBe(true);
    expect(first.nextStallStreak).toBe(1);

    const second = evaluateGoalContinuation(
      input({
        goal: { status: "active", stall_streak: first.nextStallStreak },
        lastTurn: {
          producedEvidence: false,
          calledTool: false,
          aborted: false,
          awaitingApproval: false,
        },
      }),
    );

    expect(second.nextStallStreak).toBe(GOAL_STALL_THRESHOLD);
    expect(second.shouldContinue).toBe(false);
    expect(second.reason).toBe("stalled");
  });

  it("resets the stall streak as soon as new evidence appears", () => {
    const decision = evaluateGoalContinuation(
      input({ goal: { status: "active", stall_streak: 1 } }),
    );

    expect(decision.nextStallStreak).toBe(0);
    expect(decision.shouldContinue).toBe(true);
  });

  it("lets a queued user instruction win over a continuation", () => {
    const decision = evaluateGoalContinuation(input({ queuedInstructionCount: 1 }));

    expect(decision.shouldContinue).toBe(false);
    expect(decision.reason).toBe("queued-input");
  });

  it("does not continue while other work is in flight", () => {
    expect(evaluateGoalContinuation(input({ otherWorkInFlight: true }))).toMatchObject({
      shouldContinue: false,
      reason: "work-in-flight",
    });
  });

  it("treats an interruption as a stop rather than a stall", () => {
    const decision = evaluateGoalContinuation(
      input({
        goal: { status: "active", stall_streak: 1 },
        lastTurn: {
          producedEvidence: false,
          calledTool: false,
          aborted: true,
          awaitingApproval: false,
        },
      }),
    );

    expect(decision.shouldContinue).toBe(false);
    expect(decision.reason).toBe("aborted");
    expect(decision.nextStallStreak).toBe(1);
  });

  it("stops when the work is waiting on an approval", () => {
    expect(
      evaluateGoalContinuation(
        input({
          lastTurn: {
            producedEvidence: false,
            calledTool: true,
            aborted: false,
            awaitingApproval: true,
          },
        }),
      ),
    ).toMatchObject({ shouldContinue: false, reason: "awaiting-approval" });
  });

  it("stops at the account's usage limits", () => {
    expect(evaluateGoalContinuation(input({ usageLimitsExhausted: true }))).toMatchObject({
      shouldContinue: false,
      reason: "usage-limits",
    });
  });

  it("does not continue a paused or absent goal", () => {
    expect(
      evaluateGoalContinuation(input({ goal: { status: "paused", stall_streak: 0 } })),
    ).toMatchObject({ shouldContinue: false, reason: "not-active" });
    expect(evaluateGoalContinuation(input({ goal: null }))).toMatchObject({
      shouldContinue: false,
      reason: "no-goal",
    });
  });
});

describe("isTerminalGoalStatus", () => {
  it("treats every ending as terminal and the working states as not", () => {
    expect(
      ["completed", "cleared", "blocked", "stalled", "limit_reached"].every((status) =>
        isTerminalGoalStatus(status as never),
      ),
    ).toBe(true);
    expect(isTerminalGoalStatus("active")).toBe(false);
    expect(isTerminalGoalStatus("paused")).toBe(false);
  });
});
