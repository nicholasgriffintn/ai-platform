export type TaskErrorCode =
  | "lease_busy"
  | "ownership_lost"
  | "forbidden_transition"
  | "unknown_handler"
  | "duplicate_handler"
  | "invalid_payload"
  | "final_failure";

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

export function leaseBusyError(taskId: string, expiresAt: string): TaskError {
  return new TaskError("lease_busy", `Task ${taskId} is already running`, { taskId, expiresAt });
}

export function ownershipLostError(taskId: string): TaskError {
  return new TaskError("ownership_lost", `Task ${taskId} is no longer owned by this execution`, {
    taskId,
  });
}

export function finalFailureError(taskId: string, error: unknown): TaskError {
  return new TaskError("final_failure", error instanceof Error ? error.message : String(error), {
    taskId,
  });
}

export function busyRetryDelaySeconds(error: TaskError, now = Date.now()): number {
  const expiresAt = typeof error.details?.expiresAt === "string" ? error.details.expiresAt : "";
  const delayMs = Date.parse(expiresAt) - now;

  return Number.isFinite(delayMs) ? Math.max(1, Math.ceil(delayMs / 1000)) : 1;
}
