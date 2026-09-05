import { afterEach, describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";

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

  it("makes one gateway attempt and preserves Retry-After for the run retry owner", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(new Headers(init.headers).get("cf-aig-max-attempts")).toBe("1");

      return new Response('{"error":"busy"}', {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "2.5" },
      });
    });

    vi.stubGlobal("fetch", fetchMock);
    const env = {
      AI: {
        gateway: vi.fn(() => ({ getUrl: vi.fn(async () => "https://gateway.example.com") })),
      },
    };

    await expect(
      fetchAIResponse(
        false,
        "openai",
        "/chat/completions",
        {},
        { messages: [] },
        env as unknown as IEnv,
      ),
    ).rejects.toMatchObject({
      type: "RATE_LIMIT_ERROR",
      context: { retryAfterMs: 2500 },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
