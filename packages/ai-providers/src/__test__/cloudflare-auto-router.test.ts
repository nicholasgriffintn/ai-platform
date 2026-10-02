import { CLOUDFLARE_AUTO_ROUTER_MODELS } from "@ngriffin_uk/polychat-ai-models";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CloudflareAutoRouterProvider } from "../capabilities/chat/providers/cloudflare.js";
import { StreamingFormatter } from "../formatter/streaming.js";
import type { ChatCompletionParameters } from "../types/chat.js";
import { createTestRuntime } from "./test-runtime.js";

const params: ChatCompletionParameters = {
  env: {
    ACCOUNT_ID: "account",
    AI_GATEWAY_TOKEN: "gateway-token",
    CLOUDFLARE_AUTO_ROUTER_ENABLED: "true",
  },
  model: "cloudflare/auto",
  provider: "cloudflare",
  completion_id: "conversation-1",
  context: { user: { id: 42 } },
  messages: [{ role: "user", content: "Hello" }],
};
const fetchMock = vi.fn<typeof fetch>();
const provider = new CloudflareAutoRouterProvider(createTestRuntime());

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("Cloudflare Auto Router", () => {
  it("uses gateway auth, a priced candidate pool and account-scoped session affinity", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Hello back" } }],
          usage: { prompt_tokens: 5, completion_tokens: 2 },
        }),
        { headers: { "cf-aig-routed-model": "openai/gpt-5.6-luna" } },
      ),
    );

    const result = await provider.getResponse(params);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    const body = JSON.parse(String(init?.body));

    expect(url).toBe(
      "https://gateway.ai.cloudflare.com/v1/account/llm-assistant/compat/chat/completions",
    );
    expect(headers.get("cf-aig-authorization")).toBe("Bearer gateway-token");
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.get("cf-aig-allowed-models")).toBe(
      CLOUDFLARE_AUTO_ROUTER_MODELS.map(({ gatewayModel }) => gatewayModel).join(","),
    );
    expect(headers.get("cf-aig-session-id")).toBe("42:conversation-1");
    expect(headers.get("cf-aig-skip-cache")).toBe("true");
    expect(body.model).toBe("cloudflare/auto");
    expect(result.response).toBe("Hello back");
    expect(result.usage).toEqual({
      prompt_tokens: 5,
      completion_tokens: 2,
      cloudflare_routed_model: "openai/gpt-5.6-luna",
    });
  });

  it("keeps tools and image inputs in the compatible request format", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        '{"choices":[{"message":{"tool_calls":[{"id":"call-1","type":"function","function":{"name":"lookup","arguments":"{}"}}]}}]}',
        { headers: { "cf-aig-routed-model": "anthropic/claude-sonnet-5" } },
      ),
    );
    const tools = [
      { type: "function", function: { name: "lookup", parameters: { type: "object" } } },
    ];
    const messages: ChatCompletionParameters["messages"] = [
      {
        role: "user",
        content: [{ type: "image_url", image_url: { url: "https://example.com/image.png" } }],
      },
    ];

    const result = await provider.getResponse({ ...params, tools, messages, tool_choice: "auto" });
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));

    expect(body).toMatchObject({ tools, messages, tool_choice: "auto" });
    expect(result.tool_calls).toMatchObject([{ id: "call-1", function: { name: "lookup" } }]);
  });

  it("preserves routed billing identity before streamed text, usage and the terminal event", async () => {
    const upstream =
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":5,"completion_tokens":2}}\n\ndata: [DONE]\n\n';

    fetchMock.mockResolvedValue(
      new Response(upstream, { headers: { "cf-aig-routed-model": "xai/grok-4.5" } }),
    );

    const stream = await provider.getResponse({ ...params, stream: true });
    const output = await new Response(stream).text();
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));

    expect(output).toBe(
      'data: {"choices":[],"usage":{"prompt_tokens":0,"completion_tokens":0,"cloudflare_routed_model":"xai/grok-4.5"}}\n\n' +
        upstream,
    );
    expect(body).toMatchObject({ stream: true, stream_options: { include_usage: true } });
    expect(
      StreamingFormatter.extractUsageData(JSON.parse((output.split("\n")[0] ?? "").slice(6))),
    ).toMatchObject({ cloudflare_routed_model: "xai/grok-4.5" });
  });

  it.each([
    { ...params, env: { ...params.env, CLOUDFLARE_AUTO_ROUTER_ENABLED: "false" } },
    { ...params, env: { ...params.env, AI_GATEWAY_TOKEN: "" } },
    { ...params, env: { ...params.env, ACCOUNT_ID: "" } },
    { ...params, model: "openai/gpt-5.6-luna" },
    { ...params, credentialAuthority: "byok" as const },
  ])(
    "rejects disabled, incomplete or unauthorised requests before network I/O",
    async (request) => {
      await expect(provider.getResponse(request)).rejects.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, "other/unpriced-model"])(
    "rejects missing or unknown routed identity (%s)",
    async (model) => {
      fetchMock.mockResolvedValue(
        new Response('{"choices":[],"usage":{"prompt_tokens":5}}', {
          headers: model ? { "cf-aig-routed-model": model } : {},
        }),
      );
      await expect(provider.getResponse(params)).rejects.toThrow("unrecognised routed model");
    },
  );

  it("retains gateway rate-limit errors and Retry-After", async () => {
    fetchMock.mockResolvedValue(
      new Response('{"error":"busy"}', {
        status: 429,
        headers: { "Retry-After": "2" },
      }),
    );
    await expect(provider.getResponse(params)).rejects.toMatchObject({
      statusCode: 429,
      context: expect.objectContaining({ retryAfterMs: 2000 }),
    });
  });

  it("cancels an upstream stream when routing identity cannot be verified", async () => {
    const cancel = vi.fn();

    fetchMock.mockResolvedValue(new Response(new ReadableStream({ cancel })));

    await expect(provider.getResponse({ ...params, stream: true })).rejects.toThrow(
      "unrecognised routed model",
    );
    expect(cancel).toHaveBeenCalledOnce();
  });
});
