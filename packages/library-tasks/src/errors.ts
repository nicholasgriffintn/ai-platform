export type TaskErrorCode =
  | "lease_busy"
  | "ownership_lost"
  | "forbidden_transition"
  | "unknown_handler"
  | "duplicate_handler";

export class TaskError extends Error {
  readonly code: TaskErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: TaskErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);

    this.name = "TaskError";
    this.code = code;
    this.details = details;
  }
}

export function isTaskError(error: unknown, code?: TaskErrorCode): error is TaskError {
  return error instanceof TaskError && (code === undefined || error.code === code);
}
