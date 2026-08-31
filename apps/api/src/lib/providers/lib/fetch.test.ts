import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchAIResponse } from "./fetch";

const OPTIONS = {
  requestTimeout: 1000,
  retryDelay: 500,
  maxAttempts: 1,
  backoff: "exponential" as const,
  responseType: "json" as const,
};

function callProvider() {
  return fetchAIResponse(
    true,
    "lmstudio",
    "http://127.0.0.1:1234/v1/chat/completions",
    {},
    { model: "local", messages: [] },
    undefined,
    OPTIONS,
  );
}

describe("fetchAIResponse", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("gives up on a direct provider that never sends response headers", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );

    const pending = callProvider();
    const assertion = expect(pending).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(1001);

    await assertion;
  });

  it("leaves the response stream alone once headers have arrived", async () => {
    vi.useFakeTimers();

    let capturedSignal: AbortSignal | undefined;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        capturedSignal = init.signal ?? undefined;

        return new Response(JSON.stringify({ id: "completion-1" }), {
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    await callProvider();

    await vi.advanceTimersByTimeAsync(5000);

    expect(capturedSignal?.aborted).toBe(false);
  });
});
