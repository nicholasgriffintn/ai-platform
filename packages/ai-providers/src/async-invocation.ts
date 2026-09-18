import type { AsyncInvocationData, AsyncInvocationStatus } from "./types/index.js";

export type AsyncMessageStatus = AsyncInvocationStatus;

export type AsyncInvocationMetadata = AsyncInvocationData;

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
    overrides.status ||
    (typeof base.status === "string" ? base.status : undefined) ||
    "in_progress";

  merged.lastCheckedAt = overrides.lastCheckedAt ?? base.lastCheckedAt ?? now;

  const pollIntervalFromOverride = overrides.pollIntervalMs ?? overrides.poll?.intervalMs;
  const pollIntervalFromBase = base.pollIntervalMs ?? base.poll?.intervalMs;

  merged.pollIntervalMs = pollIntervalFromOverride ?? pollIntervalFromBase ?? merged.pollIntervalMs;

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

export function isAsyncInvocationPending(metadata?: AsyncInvocationMetadata): boolean {
  return metadata?.status === "in_progress";
}
