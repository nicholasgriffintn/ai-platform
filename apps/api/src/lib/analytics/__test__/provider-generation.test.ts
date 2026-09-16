import { describe, expect, it } from "vitest";

import {
  captureProviderGenerationResult,
  type ProviderGenerationContext,
} from "../provider-generation";
import type { BackendAiGenerationCaptureInput } from "../types";

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
    startTime: 0,
    request: {
      messages: [{ role: "user", content: "hi" }],
      env: {},
    } as never,
  };
}

describe("captureProviderGenerationResult", () => {
  it("captures usage from a final event that is not blank-line terminated", async () => {
    const captured: BackendAiGenerationCaptureInput[] = [];
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
    expect(captured[0].usage).toMatchObject({ total_tokens: 14 });
    expect(captured[0].output?.content).toBe("Hi");
  });

  it("captures usage and content from blank-line terminated events", async () => {
    const captured: BackendAiGenerationCaptureInput[] = [];
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

    expect(captured[0].usage).toMatchObject({ total_tokens: 14 });
  });
});
