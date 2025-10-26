import type { AsyncInvocationData, AsyncInvocationStatus } from "~/types";

export type AsyncMessageStatus = AsyncInvocationStatus;

export type AsyncInvocationMetadata = AsyncInvocationData;

export const DEFAULT_ASYNC_POLL_INTERVAL_MS = 4000;

export function createAsyncInvocationMetadata(
  base: AsyncInvocationMetadata,
  overrides: Partial<AsyncInvocationMetadata> = {},
): AsyncInvocationMetadata {
  const now = Date.now();

  const merged: AsyncInvocationMetadata = {
    ...base,
    ...overrides,
  };

  merged.status =
    (overrides.status as AsyncMessageStatus | undefined) ||
    (typeof base.status === "string"
      ? (base.status as AsyncMessageStatus)
      : undefined) ||
    "in_progress";

  merged.lastCheckedAt = overrides.lastCheckedAt ?? base.lastCheckedAt ?? now;

  const pollIntervalFromOverride =
    overrides.pollIntervalMs ?? overrides.poll?.intervalMs;
  const pollIntervalFromBase = base.pollIntervalMs ?? base.poll?.intervalMs;

  merged.pollIntervalMs =
    pollIntervalFromOverride ?? pollIntervalFromBase ?? merged.pollIntervalMs;

  if (merged.status === "completed") {
    merged.completedAt = overrides.completedAt ?? base.completedAt ?? now;
  }

  return merged;
}

export function mergeAsyncInvocationMetadata(
  previous: AsyncInvocationMetadata | undefined,
  updates: Partial<AsyncInvocationMetadata>,
): AsyncInvocationMetadata {
  if (!previous) {
    return createAsyncInvocationMetadata(updates as AsyncInvocationMetadata);
  }

  return createAsyncInvocationMetadata(previous, {
    ...updates,
  });
}

export function isAsyncInvocationPending(
  metadata?: AsyncInvocationMetadata,
): boolean {
  return metadata?.status === "in_progress";
}

export function getAsyncPollInterval(
  metadata?: AsyncInvocationMetadata,
): number {
  const interval = metadata?.pollIntervalMs ?? metadata?.poll?.intervalMs ?? 0;

  if (!interval || interval < 1000) {
    return DEFAULT_ASYNC_POLL_INTERVAL_MS;
  }

  return interval;
}
