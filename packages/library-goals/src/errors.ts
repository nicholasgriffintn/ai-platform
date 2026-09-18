export type GoalErrorCode = "forbidden_transition";

export class GoalError extends Error {
  readonly code: GoalErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: GoalErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);

    this.name = "GoalError";
    this.code = code;
    this.details = details;
  }
}

export function isGoalError(error: unknown, code?: GoalErrorCode): error is GoalError {
  return error instanceof GoalError && (code === undefined || error.code === code);
}
