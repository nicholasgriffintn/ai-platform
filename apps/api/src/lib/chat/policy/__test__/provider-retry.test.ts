import type { ChatRetrySnapshot } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { AssistantError, ErrorType } from "~/utils/errors";
import { RetryCancelledError } from "~/utils/retries";

import { createProviderRetryBudget, runProviderCallWithRetry } from "../provider-retry";

describe("runProviderCallWithRetry", () => {
  it("spends one shared retry slot per model call across the run", async () => {
    const budget = createProviderRetryBudget(2);
    const states: unknown[] = [];
    const first = budget.forStep(1, {
      onStateChange: (state) => {
        states.push(state);
      },
    });
    const retryState: ChatRetrySnapshot = {
      protocolVersion: 1,
      step: 1,
      attempt: 2,
      maxAttempts: 2,
      runRetry: 1,
      maxRunRetries: 2,
      phase: "waiting",
      classification: "network",
      reason: "The model provider connection failed temporarily.",
      scheduledAt: "2026-09-05T12:00:00.000Z",
      retryAt: "2026-09-05T12:00:01.000Z",
    };

    await first.onStateChange?.(retryState);
    await first.onStateChange?.({ ...retryState, phase: "attempting", retryAt: null });
    await first.onStateChange?.(null);

    const second = budget.forStep(2);

    await second.onStateChange?.({ ...retryState, step: 2, runRetry: 2 });

    const third = budget.forStep(3);

    expect(first).toMatchObject({ runRetry: 1, maxRunRetries: 2, maxAttempts: 2 });
    expect(second).toMatchObject({ runRetry: 2, maxRunRetries: 2, maxAttempts: 2 });
    expect(third).toMatchObject({ runRetry: 3, maxRunRetries: 2, maxAttempts: 1 });
    expect(budget.used()).toBe(2);
    expect(states).toHaveLength(3);
  });

  it("publishes bounded retry state and respects provider Retry-After", async () => {
    const states: unknown[] = [];
    const sleeps: number[] = [];
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        new AssistantError("busy", ErrorType.RATE_LIMIT_ERROR, 429, { retryAfterMs: 2500 }),
      )
      .mockResolvedValueOnce("done");

    await expect(
      runProviderCallWithRetry(operation, {
        step: 4,
        runRetry: 1,
        maxRunRetries: 2,
        maxAttempts: 2,
        now: () => Date.parse("2026-09-05T12:00:00.000Z"),
        sleep: async (delayMs) => {
          sleeps.push(delayMs);
        },
        onStateChange: (state) => {
          states.push(state);
        },
      }),
    ).resolves.toBe("done");

    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleeps.reduce((sum, delay) => sum + delay, 0)).toBe(2500);
    expect(states).toEqual([
      expect.objectContaining({
        phase: "waiting",
        classification: "rate_limited",
        attempt: 2,
        maxAttempts: 2,
        runRetry: 1,
        maxRunRetries: 2,
        retryAt: "2026-09-05T12:00:02.500Z",
      }),
      expect.objectContaining({ phase: "attempting", retryAt: null }),
      null,
    ]);
  });

  it("does not retry credentials, policy, invalid input or conflicts", async () => {
    for (const error of [
      new AssistantError("credentials", ErrorType.AUTHENTICATION_ERROR, 401),
      new AssistantError("forbidden", ErrorType.FORBIDDEN, 403),
      new AssistantError("invalid", ErrorType.PARAMS_ERROR, 400),
      new AssistantError("conflict", ErrorType.CONFLICT_ERROR, 409),
      new AssistantError("limit", ErrorType.USAGE_LIMIT_ERROR, 429),
    ]) {
      const operation = vi.fn(async () => {
        throw error;
      });

      await expect(
        runProviderCallWithRetry(operation, {
          step: 1,
          runRetry: 1,
          maxRunRetries: 2,
          maxAttempts: 2,
        }),
      ).rejects.toBe(error);
      expect(operation).toHaveBeenCalledTimes(1);
    }
  });

  it("stops during the wait without starting another provider call", async () => {
    let stopped = false;
    const operation = vi.fn(async () => {
      throw new AssistantError("offline", ErrorType.NETWORK_ERROR, 502);
    });

    await expect(
      runProviderCallWithRetry(operation, {
        step: 1,
        runRetry: 1,
        maxRunRetries: 2,
        maxAttempts: 2,
        shouldStop: () => stopped,
        sleep: async () => {
          stopped = true;
        },
      }),
    ).rejects.toBeInstanceOf(RetryCancelledError);

    expect(operation).toHaveBeenCalledTimes(1);
  });
});
