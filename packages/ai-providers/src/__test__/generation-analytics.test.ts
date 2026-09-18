import type { AiGenerationSignal } from "@ngriffin_uk/polychat-ai-telemetry";
import { describe, expect, it } from "vitest";

import {
  captureProviderGenerationFailure,
  captureProviderGenerationResult,
  type ProviderGenerationContext,
} from "../generation-analytics.js";

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    },
  });
}

function context(): ProviderGenerationContext {
  return {
    provider: "greenpt",
    model: "green-l",
    traceId: "trace-1",
    spanId: "span-1",
    sessionId: "conversation-1",
    spanName: "chat_completion",
    startTime: performance.now(),
    request: {
      messages: [{ role: "user", content: "hi" }],
      env: {},
      tools: [{ type: "function", function: { name: "search_docs" } }],
      available_functions: [{ name: "get_weather" }],
    } as never,
  };
}

describe("captureProviderGenerationResult", () => {
  it("captures usage from a final event that is not blank-line terminated", async () => {
    const captured: AiGenerationSignal[] = [];
    const stream = streamOf(
      'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
      'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":4,"total_tokens":14}}',
    );

    const wrapped = captureProviderGenerationResult(
      stream,
      context(),
      (input) => captured.push(input),
      () => {},
    );

    await new Response(wrapped as ReadableStream).text();

    expect(captured).toHaveLength(1);
    expect(captured[0]?.usage).toMatchObject({ total_tokens: 14 });
    expect(captured[0]?.output?.content).toBe("Hi");
  });

  it("captures usage and content from blank-line terminated events", async () => {
    const captured: AiGenerationSignal[] = [];
    const stream = streamOf(
      'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
      'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":4,"total_tokens":14}}\n\n',
      "data: [DONE]\n\n",
    );

    const wrapped = captureProviderGenerationResult(
      stream,
      context(),
      (input) => captured.push(input),
      () => {},
    );

    await new Response(wrapped as ReadableStream).text();

    expect(captured[0]?.usage).toMatchObject({ total_tokens: 14 });
  });

  it("captures streaming tools, stop reason, first token latency, and session metadata", async () => {
    const captured: AiGenerationSignal[] = [];
    const stream = streamOf(
      'data: {"choices":[{"delta":{"content":"Checking"}}]}\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"get_weather","arguments":"{}"}}]}}]}\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":1,"function":{"name":"search_docs","arguments":"{}"}}]}}]}\n\n',
      'data: {"choices":[{"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":10,"completion_tokens":4}}\n\n',
    );

    const wrapped = captureProviderGenerationResult(
      stream,
      context(),
      (input) => captured.push(input),
      () => {},
    );

    await new Response(wrapped as ReadableStream).text();

    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({
      traceId: "trace-1",
      spanId: "span-1",
      sessionId: "conversation-1",
      spanName: "chat_completion",
      stream: true,
      stopReason: "tool_calls",
      toolsCalled: ["get_weather", "search_docs"],
      tools: ["search_docs", "get_weather"],
    });
    expect(typeof captured[0]?.timeToFirstTokenMs).toBe("number");
  });

  it("captures non-streaming tools and stop reason", () => {
    const captured: AiGenerationSignal[] = [];

    captureProviderGenerationResult(
      {
        response: "On it",
        tool_calls: [{ id: "call_1", function: { name: "get_weather", arguments: "{}" } }],
        finish_reason: "tool_calls",
        usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
      },
      context(),
      (input) => captured.push(input),
      () => {},
    );

    expect(captured[0]).toMatchObject({
      stream: false,
      stopReason: "tool_calls",
      toolsCalled: ["get_weather"],
    });
  });

  it("captures tool calls from raw Anthropic, Bedrock, and OpenAI shapes", () => {
    const captured: AiGenerationSignal[] = [];

    captureProviderGenerationResult(
      {
        response: "",
        content: [{ type: "tool_use", name: "anthropic_tool" }],
        choices: [{ message: { tool_calls: [{ function: { name: "openai_tool" } }] } }],
        output: { message: { content: [{ toolUse: { name: "bedrock_tool" } }] } },
      },
      context(),
      (input) => captured.push(input),
      () => {},
    );

    expect(
      [...(captured[0]?.toolsCalled ?? [])].sort((left, right) => left.localeCompare(right)),
    ).toEqual(["anthropic_tool", "bedrock_tool", "openai_tool"]);
  });

  it("captures failures with the error message", () => {
    const captured: AiGenerationSignal[] = [];

    captureProviderGenerationFailure(new Error("rate limited"), context(), (input) =>
      captured.push(input),
    );

    expect(captured[0]).toMatchObject({
      traceId: "trace-1",
      sessionId: "conversation-1",
      error: { message: "rate limited" },
    });
    expect(captured[0]?.properties).toBeUndefined();
  });

  it("tags generations with the experiment assignments on the request context", () => {
    const captured: AiGenerationSignal[] = [];
    const tagged = context();

    tagged.request = {
      ...tagged.request,
      context: { experimentAssignments: { "chat-tone": "playful" } },
    } as never;

    captureProviderGenerationFailure(new Error("rate limited"), tagged, (input) =>
      captured.push(input),
    );

    expect(captured[0]?.properties).toEqual({ "experiment.chat-tone": "playful" });
  });
});
