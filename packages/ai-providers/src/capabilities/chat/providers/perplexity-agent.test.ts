import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestRuntime } from "../../../__test__/test-runtime.js";
import type { ProviderEnv } from "../../../env.js";
import { StreamingFormatter } from "../../../formatter/streaming.js";
import { createCatalogueModelResolver } from "../../../model-resolver.js";
import type { ChatCompletionParameters } from "../../../types/index.js";
import { PerplexityAgentProvider } from "./perplexity-agent.js";

const modelConfigLookup = vi.fn();
const provider = new PerplexityAgentProvider(
  createTestRuntime({
    models: { ...createCatalogueModelResolver(), getModelConfigByMatchingModel: modelConfigLookup },
  }),
);

function requestFor(overrides: Partial<ChatCompletionParameters> = {}): ChatCompletionParameters {
  return {
    env: Object.create(null) as ProviderEnv,
    provider: "perplexity-agent",
    model: "anthropic/claude-sonnet-5-5",
    messages: [{ role: "user", content: "Compare the two reports." }],
    disable_functions: true,
    stream: false,
    ...overrides,
  };
}

function modelConfig(): ModelConfigItem {
  return {
    matchingModel: "anthropic/claude-sonnet-5-5",
    provider: "perplexity-agent",
    maxTokens: 128000,
    supportsResponseFormat: true,
    modalities: { input: ["text"], output: ["text"] },
    reasoningConfig: { supportedEffortLevels: ["none", "low", "high"], defaultEffort: "low" },
  };
}

describe("PerplexityAgentProvider", () => {
  beforeEach(() => {
    modelConfigLookup.mockReset();
    modelConfigLookup.mockResolvedValue(modelConfig());
  });

  it("always sends an output limit, which Anthropic models require", async () => {
    const body = await provider.mapParameters(requestFor());

    expect(body.max_output_tokens).toBe(128000);
  });

  it("replays a stored reply as valid Agent input on the next turn", async () => {
    const body = await provider.mapParameters(
      requestFor({
        messages: [
          { role: "user", content: "What changed?" },
          {
            role: "assistant",
            content: "Rates fell.",
            data: {
              output: [
                { type: "search_results", queries: ["rates"], results: [{ id: 1, url: "u" }] },
                {
                  id: "msg_1",
                  type: "message",
                  role: "assistant",
                  status: "completed",
                  content: [{ type: "output_text", text: "Rates fell.", annotations: [] }],
                },
              ],
            },
          },
          { role: "user", content: "Why?" },
        ],
      }),
    );

    expect(body.input).toEqual([
      { type: "message", role: "user", content: "What changed?" },
      { type: "message", role: "assistant", content: "Rates fell." },
      { type: "message", role: "user", content: "Why?" },
    ]);
  });

  it("keeps the thought signature across a tool call round trip", async () => {
    const parsed = StreamingFormatter.extractToolCall({
      type: "response.output_item.done",
      item: {
        type: "function_call",
        id: "fc_1",
        status: "completed",
        call_id: "call_1",
        name: "get_weather",
        arguments: '{"city":"Paris"}',
        thought_signature: "c2lnbmF0dXJl",
      },
    });

    const body = await provider.mapParameters(
      requestFor({
        messages: [
          { role: "user", content: "Weather in Paris?" },
          { role: "assistant", content: "", tool_calls: parsed?.toolCalls },
          { role: "tool", tool_call_id: "call_1", name: "get_weather", content: "Sunny" },
        ],
      }),
    );

    expect(body.input[1]).toEqual({
      type: "function_call",
      call_id: "call_1",
      name: "get_weather",
      arguments: '{"city":"Paris"}',
      thought_signature: "c2lnbmF0dXJl",
    });
    expect(body.input[2]).toMatchObject({ type: "function_call_output", call_id: "call_1" });
  });

  it("renames reserved tools on the wire and restores them on the way back", async () => {
    modelConfigLookup.mockResolvedValue({ ...modelConfig(), supportsToolCalls: true });

    const body = await provider.mapParameters(
      requestFor({
        disable_functions: false,
        tool_choice: { type: "function", function: { name: "web_search" } },
        tools: [
          {
            type: "function",
            function: { name: "web_search", parameters: { type: "object" } },
          },
          { type: "function", function: { name: "get_weather", parameters: {} } },
        ],
      }),
    );

    expect(body.tools.map((tool: { name: string }) => tool.name)).toEqual([
      "polychat_web_search",
      "get_weather",
    ]);
    expect(body.tool_choice).toEqual({ type: "function", name: "polychat_web_search" });

    const parsed = StreamingFormatter.extractToolCall({
      type: "response.output_item.done",
      item: { type: "function_call", call_id: "call_1", name: "polychat_web_search" },
    });

    expect(parsed?.toolCalls[0].function.name).toBe("web_search");
  });

  it("drops regex constraints the API rejects but keeps a parameter named pattern", async () => {
    modelConfigLookup.mockResolvedValue({ ...modelConfig(), supportsToolCalls: true });

    const body = await provider.mapParameters(
      requestFor({
        disable_functions: false,
        tools: [
          {
            type: "function",
            function: {
              name: "load_skill",
              parameters: {
                type: "object",
                properties: {
                  skill: { type: "string", pattern: "^[a-z]+$" },
                  pattern: { type: "string" },
                },
              },
            },
          },
        ],
      }),
    );

    expect(body.tools[0].parameters.properties).toEqual({
      skill: { type: "string" },
      pattern: { type: "string" },
    });
  });

  it("uses top-level response_format and drops efforts the API rejects", async () => {
    const response_format: ChatCompletionParameters["response_format"] = {
      type: "json_schema",
      json_schema: { name: "report", schema: { type: "object" } },
    };

    const body = await provider.mapParameters(
      requestFor({ response_format, reasoning_effort: "none" }),
    );

    expect(body.response_format).toEqual(response_format);
    expect(body.text).toBeUndefined();
    expect(body.reasoning).toBeUndefined();
  });
});
