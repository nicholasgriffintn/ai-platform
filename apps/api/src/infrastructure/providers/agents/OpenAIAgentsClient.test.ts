import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenAIAgentsClient } from "./OpenAIAgentsClient";

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
    ).rejects.toThrow("Agents API session deletion (500): provider failure");
  });
  it("redacts credentials echoed in a cleanup failure", async () => {
    const token = "sk-live-abcdefghijklmnopqrstuvwxyz";

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ message: `Bearer ${token}` }), { status: 500 }),
      ),
    );

    const deletion = new OpenAIAgentsClient(token).deleteSession("session-123");

    await expect(deletion).rejects.toMatchObject({
      type: "EXTERNAL_API_ERROR",
      statusCode: 502,
    });
    await expect(deletion).rejects.not.toThrow(token);
  });
});
