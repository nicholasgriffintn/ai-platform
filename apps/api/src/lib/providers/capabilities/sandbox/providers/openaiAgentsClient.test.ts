import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenAIAgentsClient } from "./openaiAgentsClient";

describe("OpenAIAgentsClient session cleanup", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("retries a session deletion conflict", async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    vi.stubGlobal("fetch", fetch);

    const deletion = new OpenAIAgentsClient("user-openai-key").deleteSession("session-123");

    await vi.runAllTimersAsync();
    await deletion;
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("surfaces a non-retryable cleanup failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("provider failure", { status: 500 })),
    );

    await expect(
      new OpenAIAgentsClient("user-openai-key").deleteSession("session-123"),
    ).rejects.toThrow("OpenAI session deletion failed (500)");
  });
});
