export type RetryableErrorPredicate = (error: unknown) => boolean;

export interface RetrySchedule {
  attempt: number;
  maxAttempts: number;
  error: unknown;
  delayMs: number;
}

export interface WithRetryOptions {
  maxAttempts: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  isRetryableError: RetryableErrorPredicate;
  getRetryAfterMs?: (error: unknown) => number | undefined;
  onRetryScheduled?: (schedule: RetrySchedule) => Promise<void> | void;
  onRetryAttempt?: (schedule: RetrySchedule) => Promise<void> | void;
  shouldCancel?: () => boolean;
  sleep?: (delayMs: number) => Promise<void>;
  random?: () => number;
}

export class RetryCancelledError extends Error {
  constructor() {
    super("Retry cancelled before another attempt started");
    this.name = "RetryCancelledError";
  }
}

export function isRetryCancelledError(error: unknown): error is RetryCancelledError {
  return error instanceof RetryCancelledError;
}

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function waitForRetry(
  delayMs: number,
  sleep: (delayMs: number) => Promise<void>,
  shouldCancel: () => boolean,
): Promise<void> {
  let remainingMs = delayMs;

  while (remainingMs > 0) {
    if (shouldCancel()) {
      throw new RetryCancelledError();
    }

    const sliceMs = Math.min(remainingMs, 100);

    await sleep(sliceMs);
    remainingMs -= sliceMs;
  }

  if (shouldCancel()) {
    throw new RetryCancelledError();
  }
}

function retryDelay(error: unknown, attempt: number, options: WithRetryOptions): number {
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 1000);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 30000);
  const jitterRatio = Math.max(0, Math.min(options.jitterRatio ?? 0.2, 1));
  const random = options.random ?? Math.random;
  const requestedDelayMs = options.getRetryAfterMs?.(error);
  const exponentialDelayMs = baseDelayMs * 2 ** (attempt - 1);
  const jitterMs = Math.floor(exponentialDelayMs * jitterRatio * random());

  return Math.min(maxDelayMs, Math.max(0, requestedDelayMs ?? exponentialDelayMs + jitterMs));
}

export async function withRetry<T>(
  operation: (attempt: number) => T | Promise<T>,
  options: WithRetryOptions,
): Promise<T> {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts));
  const sleep = options.sleep ?? defaultSleep;
  const shouldCancel = options.shouldCancel ?? (() => false);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (shouldCancel()) {
      throw new RetryCancelledError();
    }

    try {
      return await operation(attempt);
    } catch (error) {
      if (!options.isRetryableError(error) || attempt >= maxAttempts) {
        throw error;
      }

      const schedule = {
        attempt: attempt + 1,
        maxAttempts,
        error,
        delayMs: retryDelay(error, attempt, options),
      };

      await options.onRetryScheduled?.(schedule);
      await waitForRetry(schedule.delayMs, sleep, shouldCancel);
      await options.onRetryAttempt?.(schedule);
    }
  }

  throw new Error("Retry attempts were exhausted without producing a result or an error");
}
