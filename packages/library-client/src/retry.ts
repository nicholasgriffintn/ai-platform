import { ApiError } from "./index";

const DEFAULT_QUERY_RETRY_COUNT = 2;
const RETRYABLE_HTTP_STATUS_CODES = new Set([408, 409, 425, 429]);
const RETRYABLE_ERROR_NAMES = new Set(["AbortError", "FetchError", "TimeoutError"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }

  if (!isRecord(error)) {
    return undefined;
  }

  if (typeof error.status === "number") {
    return error.status;
  }

  return typeof error.statusCode === "number" ? error.statusCode : undefined;
}

export function shouldRetryApiQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= DEFAULT_QUERY_RETRY_COUNT) {
    return false;
  }

  const status = getErrorStatus(error);

  if (status !== undefined) {
    return RETRYABLE_HTTP_STATUS_CODES.has(status) || status >= 500;
  }

  return (
    error instanceof TypeError || (error instanceof Error && RETRYABLE_ERROR_NAMES.has(error.name))
  );
}

const DEFAULT_JITTER_MS = 125;

export interface RetryBackoff {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterMs?: number;
}

export interface WithRetryOptions extends RetryBackoff {
  isRetryable: (error: unknown) => boolean;
  getRetryAfterMs?: (error: unknown) => number | undefined;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function parseRetryAfterHeaderMs(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(value);

  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return undefined;
}

export function parseRetryAfterBodyMs(body: string): number | undefined {
  try {
    const data = JSON.parse(body) as { retryAfter?: unknown };

    return typeof data.retryAfter === "number" && Number.isFinite(data.retryAfter)
      ? data.retryAfter * 1000
      : undefined;
  } catch {
    return undefined;
  }
}

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: WithRetryOptions,
): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs } = options;
  const jitterMs = options.jitterMs ?? DEFAULT_JITTER_MS;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (!options.isRetryable(error) || attempt === maxAttempts) {
        throw error;
      }

      const retryAfterMs = options.getRetryAfterMs?.(error);
      const exponentialDelayMs = baseDelayMs * 2 ** (attempt - 1) + Math.floor(random() * jitterMs);

      await sleep(Math.min(retryAfterMs ?? exponentialDelayMs, maxDelayMs));
    }
  }

  throw new Error("Retry attempts were exhausted without producing a result or an error");
}
