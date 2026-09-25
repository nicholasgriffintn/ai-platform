import type { Goal, GoalStatus } from "@ngriffin_uk/polychat-schemas";

export const GOAL_STALL_THRESHOLD = 2;

export interface GoalContinuationInput {
  goal: Pick<Goal, "status" | "stall_streak"> | null;
  lastTurn: {
    producedEvidence: boolean;
    calledTool: boolean;
    aborted: boolean;
    awaitingApproval: boolean;
  };
  usageLimitsExhausted: boolean;
  queuedInstructionCount: number;
  otherWorkInFlight: boolean;
}

export type GoalContinuationReason =
  | "continue"
  | "no-goal"
  | "not-active"
  | "aborted"
  | "awaiting-approval"
  | "queued-input"
  | "work-in-flight"
  | "usage-limits"
  | "stalled";

export interface GoalContinuationDecision {
  shouldContinue: boolean;
  reason: GoalContinuationReason;
  nextStallStreak: number;
}

export function evaluateGoalContinuation(input: GoalContinuationInput): GoalContinuationDecision {
  const currentStreak = input.goal?.stall_streak ?? 0;
  const madeProgress = input.lastTurn.producedEvidence || input.lastTurn.calledTool;
  const nextStallStreak = madeProgress ? 0 : currentStreak + 1;

  if (!input.goal) {
    return { shouldContinue: false, reason: "no-goal", nextStallStreak: 0 };
  }

  if (input.goal.status !== "active") {
    return { shouldContinue: false, reason: "not-active", nextStallStreak: currentStreak };
  }

  if (input.lastTurn.aborted) {
    return { shouldContinue: false, reason: "aborted", nextStallStreak: currentStreak };
  }

  if (input.lastTurn.awaitingApproval) {
    return { shouldContinue: false, reason: "awaiting-approval", nextStallStreak: currentStreak };
  }

  if (input.queuedInstructionCount > 0) {
    return { shouldContinue: false, reason: "queued-input", nextStallStreak: currentStreak };
  }

  if (input.otherWorkInFlight) {
    return { shouldContinue: false, reason: "work-in-flight", nextStallStreak: currentStreak };
  }

  if (input.usageLimitsExhausted) {
    return { shouldContinue: false, reason: "usage-limits", nextStallStreak };
  }

  if (nextStallStreak >= GOAL_STALL_THRESHOLD) {
    return { shouldContinue: false, reason: "stalled", nextStallStreak };
  }

  return { shouldContinue: true, reason: "continue", nextStallStreak };
}

export interface GoalIterationInput {
  producedEvidence: boolean;
  calledTool: boolean;
  aborted?: boolean;
  awaitingUserAction?: "approval" | "question";
  usageLimitsExhausted?: boolean;
  queuedInstructionCount?: number;
  otherWorkInFlight?: boolean;
}

export interface GoalIterationPlan {
  shouldContinue: boolean;
  reason: GoalContinuationReason;
  stallStreak: number;
  status?: GoalStatus;
  stoppedReason?: string;
}

export function planGoalIteration(params: {
  goal: Pick<Goal, "status" | "stall_streak"> | null;
  iteration: GoalIterationInput;
}): GoalIterationPlan {
  const { goal, iteration } = params;
  const decision = evaluateGoalContinuation({
    goal,
    lastTurn: {
      producedEvidence: iteration.producedEvidence,
      calledTool: iteration.calledTool,
      aborted: iteration.aborted === true,
      awaitingApproval: iteration.awaitingUserAction !== undefined,
    },
    usageLimitsExhausted: iteration.usageLimitsExhausted === true,
    queuedInstructionCount: iteration.queuedInstructionCount ?? 0,
    otherWorkInFlight: iteration.otherWorkInFlight === true,
  });

  const status = goalStatusForReason(decision.reason);

  return {
    shouldContinue: decision.shouldContinue,
    reason: decision.reason,
    stallStreak: decision.nextStallStreak,
    ...(status
      ? { status, stoppedReason: stoppedReasonFor(status, iteration.awaitingUserAction) }
      : {}),
  };
}

function goalStatusForReason(reason: GoalContinuationReason): GoalStatus | undefined {
  if (reason === "stalled") {
    return "stalled";
  }

  if (reason === "usage-limits") {
    return "limit_reached";
  }

  if (reason === "awaiting-approval") {
    return "blocked";
  }

  return undefined;
}

function stoppedReasonFor(
  status: GoalStatus,
  awaitingUserAction?: "approval" | "question",
): string {
  if (status === "stalled") {
    return "Consecutive continuations produced no new evidence.";
  }

  if (status === "limit_reached") {
    return "The account's usage limits were reached.";
  }

  return awaitingUserAction === "question"
    ? "The work is waiting for your answers."
    : "The work is waiting for your approval.";
}
