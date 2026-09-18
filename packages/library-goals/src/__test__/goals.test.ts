import { describe, expect, it } from "vitest";

import {
  assertGoalTransition,
  evaluateGoalContinuation,
  GOAL_STALL_THRESHOLD,
  GoalError,
  isTerminalGoalStatus,
  planGoalIteration,
  type GoalContinuationInput,
} from "../index.js";

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

describe("planGoalIteration", () => {
  it("maps a stall to the stalled status and reason", () => {
    const plan = planGoalIteration({
      goal: { status: "active", stall_streak: 1 },
      iteration: { producedEvidence: false, calledTool: false },
    });

    expect(plan).toMatchObject({
      shouldContinue: false,
      reason: "stalled",
      status: "stalled",
      stoppedReason: "Consecutive continuations produced no new evidence.",
    });
    expect(plan.stallStreak).toBe(GOAL_STALL_THRESHOLD);
  });

  it("blocks a goal that is waiting on a human", () => {
    expect(
      planGoalIteration({
        goal: { status: "active", stall_streak: 0 },
        iteration: { producedEvidence: true, calledTool: true, awaitingUserAction: "question" },
      }),
    ).toMatchObject({
      shouldContinue: false,
      reason: "awaiting-approval",
      status: "blocked",
      stoppedReason: "The work is waiting for your answers.",
    });
  });

  it("maps exhausted usage limits to the limit_reached status", () => {
    expect(
      planGoalIteration({
        goal: { status: "active", stall_streak: 0 },
        iteration: { producedEvidence: true, calledTool: true, usageLimitsExhausted: true },
      }),
    ).toMatchObject({
      shouldContinue: false,
      reason: "usage-limits",
      status: "limit_reached",
    });
  });
});

describe("assertGoalTransition", () => {
  it("only lets each actor make its own transitions", () => {
    expect(() => assertGoalTransition({ actor: "model", from: "active", to: "paused" })).toThrow(
      /may not move a goal to paused/,
    );
    expect(() => assertGoalTransition({ actor: "user", from: "active", to: "completed" })).toThrow(
      /may not move a goal to completed/,
    );
    expect(() =>
      assertGoalTransition({ actor: "user", from: "active", to: "paused" }),
    ).not.toThrow();
  });

  it("refuses to reopen a goal that already ended", () => {
    expect(() => assertGoalTransition({ actor: "user", from: "completed", to: "paused" })).toThrow(
      /already ended as completed/,
    );
  });

  it("throws a coded GoalError", () => {
    expect(() => assertGoalTransition({ actor: "model", from: "active", to: "paused" })).toThrow(
      GoalError,
    );
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
