export type TaskResultStatus = "success" | "error" | "skipped" | "suspended" | "pending";

export interface TaskResult {
  status: TaskResultStatus;
  message?: string;
  data?: Record<string, unknown>;
  retryAfterSeconds?: number;
}

export type TaskSettlement =
  | { status: "completed"; completedAt: string }
  | { status: "suspended" }
  | { status: "failed"; attempts: number; error: string }
  | { status: "queued"; attempts: number; error: string };

export interface SettleTaskOptions {
  attempts: number;
  maxAttempts: number;
  retryable?: boolean;
}

export const DEFAULT_TASK_MAX_ATTEMPTS = 3;

export function settleTaskSuccess(
  result: Pick<TaskResult, "status">,
  now: () => number = Date.now,
): Extract<TaskSettlement, { status: "completed" | "suspended" }> {
  return result.status === "suspended"
    ? { status: "suspended" }
    : { status: "completed", completedAt: new Date(now()).toISOString() };
}

export function settleTaskFailure(
  error: unknown,
  options: SettleTaskOptions,
): Extract<TaskSettlement, { status: "failed" | "queued" }> {
  const attempts = options.attempts + 1;
  const message = error instanceof Error ? error.message : String(error);

  if (options.retryable === false || attempts >= Math.max(1, options.maxAttempts)) {
    return { status: "failed", attempts, error: message };
  }

  return { status: "queued", attempts, error: message };
}
