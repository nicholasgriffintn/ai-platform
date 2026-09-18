export { GoalError, isGoalError, type GoalErrorCode } from "./errors.js";
export {
  assertGoalTransition,
  isTerminalGoalStatus,
  TERMINAL_GOAL_STATUSES,
  type GoalActor,
  type GoalTransition,
} from "./lifecycle.js";
export {
  evaluateGoalContinuation,
  GOAL_STALL_THRESHOLD,
  planGoalIteration,
  type GoalContinuationDecision,
  type GoalContinuationInput,
  type GoalContinuationReason,
  type GoalIterationInput,
  type GoalIterationPlan,
} from "./continuation.js";
export { appendGoalProgressEntry, GOAL_PROGRESS_JOURNAL_LIMIT } from "./journal.js";
export { goalStatusLabels } from "./labels.js";
