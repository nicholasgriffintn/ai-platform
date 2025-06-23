import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withRetry } from "../retries";

describe("retries", () => {
  let originalUnhandledRejection: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();

    originalUnhandledRejection = process.listeners("unhandledRejection");
    process.removeAllListeners("unhandledRejection");
    process.on("unhandledRejection", () => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();

    process.removeAllListeners("unhandledRejection");
    originalUnhandledRejection.forEach((handler: any) => {
      process.on("unhandledRejection", handler);
    });
  });

  describe("withRetry", () => {
    it("should return result on first success", async () => {
      const mockFn = vi.fn().mockResolvedValue("success");

      const result = await withRetry(mockFn);

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure and eventually succeed", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("first fail"))
        .mockRejectedValueOnce(new Error("second fail"))
        .mockResolvedValue("success");

      const promise = withRetry(mockFn);

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it("should throw error after exhausting retries", async () => {
      const error = new Error("persistent error");
      const mockFn = vi.fn().mockRejectedValue(error);

      const promise = withRetry(mockFn, { retryCount: 2 });

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow("persistent error");
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it("should use custom retry count", async () => {
      const error = new Error("error");
      const mockFn = vi.fn().mockRejectedValue(error);

      const promise = withRetry(mockFn, { retryCount: 1 });

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow("error");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("should use custom base delay", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValue("success");

      const onRetry = vi.fn();

      const promise = withRetry(mockFn, {
        baseDelayMs: 1000,
        onRetry,
      });

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
      expect(onRetry).toHaveBeenCalledWith(
        1,
        expect.any(Error),
        expect.any(Number),
      );

      const delayMs = onRetry.mock.calls[0][2];
      expect(delayMs).toBeGreaterThanOrEqual(700);
      expect(delayMs).toBeLessThan(1600);
    });

    it("should apply exponential backoff", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail1"))
        .mockRejectedValueOnce(new Error("fail2"))
        .mockResolvedValue("success");

      const onRetry = vi.fn();

      const promise = withRetry(mockFn, {
        baseDelayMs: 100,
        onRetry,
      });

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
      expect(onRetry).toHaveBeenCalledTimes(2);

      const firstDelay = onRetry.mock.calls[0][2];
      expect(firstDelay).toBeGreaterThanOrEqual(70);
      expect(firstDelay).toBeLessThan(160);

      const secondDelay = onRetry.mock.calls[1][2];
      expect(secondDelay).toBeGreaterThanOrEqual(140);
      expect(secondDelay).toBeLessThan(320);
    });

    it("should respect isRetryableError predicate", async () => {
      const retryableError = new Error("retryable");
      const nonRetryableError = new Error("non-retryable");

      const mockFn = vi.fn().mockRejectedValue(nonRetryableError);

      const isRetryableError = vi.fn((error: unknown) => {
        return (error as Error).message === "retryable";
      });

      await expect(withRetry(mockFn, { isRetryableError })).rejects.toThrow(
        "non-retryable",
      );

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(isRetryableError).toHaveBeenCalledWith(nonRetryableError);
    });

    it("should retry retryable errors", async () => {
      const retryableError = new Error("retryable");
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue("success");

      const isRetryableError = vi.fn((error: unknown) => {
        return (error as Error).message === "retryable";
      });

      const promise = withRetry(mockFn, { isRetryableError });

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(isRetryableError).toHaveBeenCalledWith(retryableError);
    });

    it("should call onRetry callback with correct parameters", async () => {
      const error1 = new Error("error1");
      const error2 = new Error("error2");

      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockResolvedValue("success");

      const onRetry = vi.fn();

      const promise = withRetry(mockFn, { onRetry });

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
      expect(onRetry).toHaveBeenCalledTimes(2);

      expect(onRetry).toHaveBeenNthCalledWith(1, 1, error1, expect.any(Number));
      expect(onRetry).toHaveBeenNthCalledWith(2, 2, error2, expect.any(Number));
    });

    it("should handle zero retry count", async () => {
      const error = new Error("error");
      const mockFn = vi.fn().mockRejectedValue(error);

      await expect(withRetry(mockFn, { retryCount: 0 })).rejects.toThrow(
        "error",
      );

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should handle async functions that return promises", async () => {
      let callCount = 0;
      const mockFn = vi.fn(async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error(`attempt ${callCount}`);
        }
        return `success after ${callCount} attempts`;
      });

      const promise = withRetry(mockFn);

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe("success after 3 attempts");
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it("should handle synchronous functions that throw", async () => {
      let callCount = 0;
      const mockFn = vi.fn(() => {
        callCount++;
        if (callCount < 2) {
          throw new Error(`sync error ${callCount}`);
        }
        return `sync success after ${callCount} attempts`;
      });

      // @ts-expect-error - mockFn is not a function
      const promise = withRetry(mockFn);

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe("sync success after 2 attempts");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("should apply jitter to delay times", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValue("success");

      const onRetry = vi.fn();

      const promise = withRetry(mockFn, { baseDelayMs: 100, onRetry });
      await vi.runAllTimersAsync();
      await promise;

      expect(onRetry).toHaveBeenCalledTimes(1);
      const delay = onRetry.mock.calls[0][2];
      expect(delay).toBeGreaterThanOrEqual(70);
      expect(delay).toBeLessThan(160);
    });

    it("should handle default options", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValue("success");

      const promise = withRetry(mockFn);

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });
});
