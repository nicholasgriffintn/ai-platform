import { describe, expect, it } from "vitest";

import { ApiError } from "./index";
import {
  parseRetryAfterBodyMs,
  parseRetryAfterHeaderMs,
  shouldRetryApiQuery,
  withRetry,
} from "./retry";

describe("shouldRetryApiQuery", () => {
  it("retries transient failures but not authentication failures", () => {
    expect(shouldRetryApiQuery(0, new ApiError("Server error", 500))).toBe(true);
    expect(shouldRetryApiQuery(0, new ApiError("Unauthorized", 401))).toBe(false);
    expect(shouldRetryApiQuery(2, new ApiError("Server error", 500))).toBe(false);
  });
});

describe("parseRetryAfterHeaderMs", () => {
  it("reads delay seconds", () => {
    expect(parseRetryAfterHeaderMs("60")).toBe(60_000);
    expect(parseRetryAfterHeaderMs("0")).toBe(0);
  });

  it("reads an HTTP date as a delay from now", () => {
    const value = new Date(Date.now() + 30_000).toUTCString();

    expect(parseRetryAfterHeaderMs(value)).toBeGreaterThan(28_000);
  });

  it("clamps a past HTTP date to zero", () => {
    expect(parseRetryAfterHeaderMs(new Date(Date.now() - 30_000).toUTCString())).toBe(0);
  });

  it("ignores a missing or unparseable value", () => {
    expect(parseRetryAfterHeaderMs(null)).toBeUndefined();
    expect(parseRetryAfterHeaderMs("soon")).toBeUndefined();
  });
});

describe("parseRetryAfterBodyMs", () => {
  it("reads the Polychat rate-limit body", () => {
    expect(parseRetryAfterBodyMs(JSON.stringify({ retryAfter: 60 }))).toBe(60_000);
  });

  it("ignores a non-JSON or unrelated body", () => {
    expect(parseRetryAfterBodyMs("nope")).toBeUndefined();
    expect(parseRetryAfterBodyMs(JSON.stringify({ error: "boom" }))).toBeUndefined();
  });
});

function createRecorder() {
  const delays: number[] = [];

  return {
    delays,
    sleep: async (ms: number) => {
      delays.push(ms);
    },
    random: () => 0,
  };
}

describe("withRetry", () => {
  const backoff = { maxAttempts: 3, baseDelayMs: 400, maxDelayMs: 3000 };

  it("returns the first successful result without sleeping", async () => {
    const recorder = createRecorder();

    await expect(
      withRetry(async () => "ok", { ...backoff, isRetryable: () => true, ...recorder }),
    ).resolves.toBe("ok");
    expect(recorder.delays).toEqual([]);
  });

  it("backs off exponentially between attempts", async () => {
    const recorder = createRecorder();
    let attempts = 0;

    const result = await withRetry(
      async () => {
        attempts += 1;

        if (attempts < 3) {
          throw new Error("transient");
        }

        return attempts;
      },
      { ...backoff, isRetryable: () => true, ...recorder },
    );

    expect(result).toBe(3);
    expect(recorder.delays).toEqual([400, 800]);
  });

  it("stops immediately when the error is not retryable", async () => {
    const recorder = createRecorder();
    let attempts = 0;

    await expect(
      withRetry(
        async () => {
          attempts += 1;
          throw new Error("fatal");
        },
        { ...backoff, isRetryable: () => false, ...recorder },
      ),
    ).rejects.toThrow("fatal");

    expect(attempts).toBe(1);
    expect(recorder.delays).toEqual([]);
  });

  it("rethrows the final error once attempts are exhausted", async () => {
    const recorder = createRecorder();
    let attempts = 0;

    await expect(
      withRetry(
        async () => {
          attempts += 1;
          throw new Error(`attempt ${attempts}`);
        },
        { ...backoff, isRetryable: () => true, ...recorder },
      ),
    ).rejects.toThrow("attempt 3");

    expect(recorder.delays).toEqual([400, 800]);
  });

  it("prefers a Retry-After delay over the exponential delay", async () => {
    const recorder = createRecorder();
    let attempts = 0;

    await withRetry(
      async () => {
        attempts += 1;

        if (attempts < 2) {
          throw new Error("slow down");
        }

        return attempts;
      },
      { ...backoff, isRetryable: () => true, getRetryAfterMs: () => 1500, ...recorder },
    );

    expect(recorder.delays).toEqual([1500]);
  });

  it("caps any delay at maxDelayMs", async () => {
    const recorder = createRecorder();
    let attempts = 0;

    await withRetry(
      async () => {
        attempts += 1;

        if (attempts < 2) {
          throw new Error("slow down");
        }

        return attempts;
      },
      { ...backoff, isRetryable: () => true, getRetryAfterMs: () => 90_000, ...recorder },
    );

    expect(recorder.delays).toEqual([3000]);
  });
});
