import { CHAT_RETRY_PROTOCOL_VERSION, type ChatRetrySnapshot } from "@ngriffin_uk/polychat-schemas";

import { classifyProviderRetryError, getProviderRetryAfterMs } from "~/utils/providerErrors";
import { withRetry, type WithRetryOptions } from "~/utils/retries";

const MODEL_RETRY_BASE_DELAY_MS = 1000;
const MODEL_RETRY_MAX_DELAY_MS = 30000;

export interface ProviderRetryExecutionOptions {
  step: number;
  runRetry: number;
  maxRunRetries: number;
  maxAttempts: number;
  shouldStop?: () => boolean;
  onStateChange?: (state: ChatRetrySnapshot | null) => Promise<void> | void;
  sleep?: WithRetryOptions["sleep"];
  random?: WithRetryOptions["random"];
  now?: () => number;
}

export interface ProviderRetryBudgetOptions {
  shouldStop?: () => boolean;
  onStateChange?: (state: ChatRetrySnapshot | null) => Promise<void> | void;
}

export interface ProviderRetryBudget {
  forStep(step: number, options?: ProviderRetryBudgetOptions): ProviderRetryExecutionOptions;
  used(): number;
}

export function createProviderRetryBudget(maxRunRetries = 2): ProviderRetryBudget {
  const boundedMaxRunRetries = Math.max(0, Math.floor(maxRunRetries));
  let retriesUsed = 0;

  return {
    forStep(step, options = {}) {
      const runRetry = retriesUsed + 1;
      let scheduled = false;

      return {
        step,
        runRetry,
        maxRunRetries: boundedMaxRunRetries,
        maxAttempts: retriesUsed < boundedMaxRunRetries ? 2 : 1,
        shouldStop: options.shouldStop,
        onStateChange: async (state) => {
          if (state && !scheduled) {
            scheduled = true;
            retriesUsed += 1;
          }

          await options.onStateChange?.(state);
        },
      };
    },
    used: () => retriesUsed,
  };
}

export async function runProviderCallWithRetry<T>(
  operation: () => T | Promise<T>,
  options: ProviderRetryExecutionOptions,
): Promise<T> {
  const now = options.now ?? Date.now;
  let activeRetry: ChatRetrySnapshot | null = null;

  try {
    return await withRetry(operation, {
      maxAttempts: options.maxAttempts,
      baseDelayMs: MODEL_RETRY_BASE_DELAY_MS,
      maxDelayMs: MODEL_RETRY_MAX_DELAY_MS,
      isRetryableError: (error) => classifyProviderRetryError(error).retryable,
      getRetryAfterMs: getProviderRetryAfterMs,
      shouldCancel: options.shouldStop,
      sleep: options.sleep,
      random: options.random,
      onRetryScheduled: async (schedule) => {
        const classification = classifyProviderRetryError(schedule.error);
        const scheduledAtMs = now();

        activeRetry = {
          protocolVersion: CHAT_RETRY_PROTOCOL_VERSION,
          step: options.step,
          attempt: schedule.attempt,
          maxAttempts: schedule.maxAttempts,
          runRetry: options.runRetry,
          maxRunRetries: options.maxRunRetries,
          phase: "waiting",
          classification: classification.classification ?? "provider_unavailable",
          reason: classification.reason,
          scheduledAt: new Date(scheduledAtMs).toISOString(),
          retryAt: new Date(scheduledAtMs + schedule.delayMs).toISOString(),
        };

        await options.onStateChange?.(activeRetry);
      },
      onRetryAttempt: async () => {
        if (!activeRetry) {
          return;
        }

        activeRetry = { ...activeRetry, phase: "attempting", retryAt: null };
        await options.onStateChange?.(activeRetry);
      },
    });
  } finally {
    if (activeRetry) {
      await options.onStateChange?.(null);
    }
  }
}
