import { describe, expect, it, vi } from "vitest";

import { RetryCancelledError, withRetry } from "../retries";

describe("withRetry", () => {
  it("bounds attempts and publishes waiting before attempting", async () => {
    const events: string[] = [];
    const operation = vi
      .fn<(attempt: number) => Promise<string>>()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce("done");

    await expect(
      withRetry(operation, {
        maxAttempts: 2,
        baseDelayMs: 10,
        jitterRatio: 0,
        isRetryableError: () => true,
        sleep: async () => undefined,
        onRetryScheduled: ({ attempt }) => {
          events.push(`waiting:${attempt}`);
        },
        onRetryAttempt: ({ attempt }) => {
          events.push(`attempting:${attempt}`);
        },
      }),
    ).resolves.toBe("done");

    expect(operation).toHaveBeenCalledTimes(2);
    expect(events).toEqual(["waiting:2", "attempting:2"]);
  });

  it("does not retry a classified permanent failure", async () => {
    const operation = vi.fn(async () => {
      throw new Error("invalid input");
    });

    await expect(
      withRetry(operation, {
        maxAttempts: 2,
        isRetryableError: () => false,
      }),
    ).rejects.toThrow("invalid input");

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("cancels during backoff without starting another attempt", async () => {
    let cancelled = false;
    const operation = vi.fn(async () => {
      throw new Error("temporary");
    });

    await expect(
      withRetry(operation, {
        maxAttempts: 2,
        baseDelayMs: 200,
        jitterRatio: 0,
        isRetryableError: () => true,
        shouldCancel: () => cancelled,
        sleep: async () => {
          cancelled = true;
        },
      }),
    ).rejects.toBeInstanceOf(RetryCancelledError);

    expect(operation).toHaveBeenCalledTimes(1);
  });
});
