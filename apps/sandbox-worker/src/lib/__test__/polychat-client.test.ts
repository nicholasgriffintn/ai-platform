import { afterEach, describe, expect, it, vi } from "vitest";

import { PolychatApiError, PolychatClient } from "../polychat-client";

describe("PolychatClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends authorization and user-agent headers", async () => {
    const serviceFetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "ok" } }],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const client = new PolychatClient("token-123", {
      fetch: serviceFetchMock,
    });
    const result = await client.chatCompletion({
      messages: [{ role: "user", content: "hello" }],
      model: "mistral-large",
      temperature: 0.2,
      top_p: 0.9,
      reasoning: {
        effort: "high",
      },
      verbosity: "low",
    });

    expect(result).toEqual({
      content: "ok",
      toolCalls: [],
      message: { content: "ok" },
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cachedInputTokens: 0 },
    });
    expect(serviceFetchMock).toHaveBeenCalledTimes(1);
    const request = serviceFetchMock.mock.calls[0][0] as Request;

    expect(request.url).toBe("http://polychat-api/chat/completions");
    expect(request.headers.get("Authorization")).toBe("Bearer token-123");
    expect(request.headers.get("User-Agent")).toBe(
      "Polychat-Sandbox-Worker/1.0 (+https://polychat.app)",
    );
    await expect(request.json()).resolves.toMatchObject({
      model: "mistral-large",
      temperature: 0.2,
      top_p: 0.9,
      reasoning: {
        effort: "high",
      },
      verbosity: "low",
    });
  });

  it("retries retryable API failures", async () => {
    const serviceFetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("temporary outage", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "recovered" } }],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    const client = new PolychatClient("token-123", {
      fetch: serviceFetchMock,
    });
    const result = await client.chatCompletion(
      {
        messages: [{ role: "user", content: "hello" }],
        model: "mistral-large",
      },
      {
        maxAttempts: 2,
        baseDelayMs: 1,
        maxDelayMs: 1,
      },
    );

    expect(result).toMatchObject({ content: "recovered", toolCalls: [] });
    expect(serviceFetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-retryable API failures", async () => {
    const serviceFetchMock = vi.fn().mockResolvedValue(
      new Response("bad request", {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      }),
    );
    const client = new PolychatClient("token-123", {
      fetch: serviceFetchMock,
    });

    await expect(
      client.chatCompletion(
        {
          messages: [{ role: "user", content: "hello" }],
          model: "mistral-large",
        },
        {
          maxAttempts: 3,
          baseDelayMs: 1,
          maxDelayMs: 1,
        },
      ),
    ).rejects.toBeInstanceOf(PolychatApiError);
    expect(serviceFetchMock).toHaveBeenCalledTimes(1);
  });

  it("captures retry-after metadata from rate limit responses", async () => {
    const serviceFetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Rate limit exceeded", retryAfter: 60 }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new PolychatClient("token-123", {
      fetch: serviceFetchMock,
    });

    await expect(
      client.chatCompletion(
        {
          messages: [{ role: "user", content: "hello" }],
          model: "mistral-large",
        },
        {
          maxAttempts: 1,
          baseDelayMs: 1,
          maxDelayMs: 1,
        },
      ),
    ).rejects.toMatchObject({
      status: 429,
      retryable: true,
      retryAfterMs: 60_000,
    });
  });

  it("preserves assistant reasoning and tool calls for exact multi-turn replay", async () => {
    const assistantMessage = {
      role: "assistant" as const,
      content: null,
      reasoning_content: "Inspect the goal before editing.",
      tool_calls: [
        {
          id: "call-1",
          type: "function",
          function: { name: "read_lean_file", arguments: '{"path":"Main.lean"}' },
        },
      ],
    };
    const serviceFetchMock = vi.fn().mockResolvedValue(
      Response.json({
        choices: [{ message: assistantMessage }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 20,
          total_tokens: 120,
          prompt_tokens_details: { cached_tokens: 40 },
        },
      }),
    );
    const client = new PolychatClient("token-123", { fetch: serviceFetchMock });
    const messages = [
      assistantMessage,
      {
        role: "tool" as const,
        content: "1: theorem example := by",
        tool_call_id: "call-1",
        name: "read_lean_file",
      },
    ];
    const result = await client.chatCompletion({ messages, model: "labs-leanstral-1-5" });
    const request = serviceFetchMock.mock.calls[0][0] as Request;

    await expect(request.json()).resolves.toMatchObject({ messages });
    expect(result.message).toEqual(assistantMessage);
    expect(result.usage).toEqual({
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120,
      cachedInputTokens: 40,
    });
  });
});
