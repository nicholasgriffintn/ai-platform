import type { AsyncInvocationData } from "~/types";

export type AsyncMessageStatus = "in_progress" | "completed" | "failed";

export interface AsyncInvocationMetadata extends AsyncInvocationData {
  provider: string;
  type?: string;
  operation?: string;
  region?: string;
  pollIntervalMs?: number;
  status?: AsyncMessageStatus | string;
  lastCheckedAt?: number;
  completedAt?: number;
  initialResponse?: Record<string, any>;
  [key: string]: any;
}

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
  if (!metadata?.pollIntervalMs || metadata.pollIntervalMs < 1000) {
    return DEFAULT_ASYNC_POLL_INTERVAL_MS;
  }

  return metadata.pollIntervalMs;
}
