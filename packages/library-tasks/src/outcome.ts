export type TaskResultStatus = "success" | "error" | "skipped" | "suspended";

export interface TaskResult {
  status: TaskResultStatus;
  message?: string;
  data?: Record<string, unknown>;
}

export type TaskSettlement =
  | { status: "completed"; completedAt: string }
  | { status: "suspended" }
  | { status: "failed"; attempts: number; error: string }
  | { status: "queued"; attempts: number; error: string; retryDelayMs: number };

export interface RetryBackoff {
  baseDelayMs: number;
  maxDelayMs?: number;
  factor?: number;
}

export interface SettleTaskOptions {
  attempts: number;
  maxAttempts: number;
  backoff?: RetryBackoff;
  now?: () => number;
}

export const DEFAULT_TASK_MAX_ATTEMPTS = 3;

export function retryDelayMs(attempt: number, backoff?: RetryBackoff): number {
  if (!backoff) {
    return 0;
  }

  const delay = backoff.baseDelayMs * Math.pow(backoff.factor ?? 2, Math.max(0, attempt - 1));

  return Math.min(delay, backoff.maxDelayMs ?? delay);
}

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

  if (attempts >= Math.max(1, options.maxAttempts)) {
    return { status: "failed", attempts, error: message };
  }

  return {
    status: "queued",
    attempts,
    error: message,
    retryDelayMs: retryDelayMs(attempts, options.backoff),
  };
}
