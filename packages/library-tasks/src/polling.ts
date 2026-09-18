export const DEFAULT_POLLING_DELAYS_SECONDS: readonly number[] = [5, 10, 20, 30, 30];
export const DEFAULT_POLLING_MAX_ATTEMPTS = 60;

export interface PollingScheduleOptions {
  attempt?: number;
  delaysSeconds?: readonly number[];
  maxAttempts?: number;
  now?: () => number;
}

export interface PollingSchedule {
  attempt: number;
  delaySeconds: number;
  scheduledAt: string;
  exhausted: boolean;
}

export function pollingSchedule(options: PollingScheduleOptions = {}): PollingSchedule {
  const delays = options.delaysSeconds?.length
    ? options.delaysSeconds
    : DEFAULT_POLLING_DELAYS_SECONDS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_POLLING_MAX_ATTEMPTS;
  const now = options.now ?? Date.now;
  const attempt = (options.attempt ?? 0) + 1;
  const delaySeconds = delays[Math.min(attempt, delays.length) - 1] ?? 0;

  return {
    attempt,
    delaySeconds,
    scheduledAt: new Date(now() + delaySeconds * 1000).toISOString(),
    exhausted: attempt > maxAttempts,
  };
}
