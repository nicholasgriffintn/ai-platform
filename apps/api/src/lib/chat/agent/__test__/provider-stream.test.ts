import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/providers/models", () => ({
  findModelConfig: vi.fn(async () => ({ modalities: { input: ["text"], output: ["text"] } })),
}));

import { consumeProviderStream } from "../provider-stream";

function providerStream(chunks: string[]): ReadableStream<Uint8Array> {
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

function textDelta(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

function createSink() {
  const events: { type: string; payload: unknown }[] = [];

  return {
    events,
    sink: {
      writeEvent: async (type: string, payload?: unknown) => {
        events.push({ type, payload });
      },
    },
  };
}

const context = {
  env: { AI: {} } as never,
  model: "test-model",
  provider: "openai",
  completionId: "completion-1",
};

describe("consumeProviderStream", () => {
  it("forwards each delta and returns the assembled text", async () => {
    const { sink, events } = createSink();

    const turn = await consumeProviderStream(
      providerStream([textDelta("Hello "), textDelta("world"), "data: [DONE]\n\n"]),
      sink,
      context,
    );

    expect(turn.content).toBe("Hello world");
    expect(events.filter((event) => event.type === "content_block_delta")).toHaveLength(2);
  });

  it("reassembles a delta split across two network chunks", async () => {
    const { sink } = createSink();
    const event = textDelta("split");
    const midpoint = Math.floor(event.length / 2);

    const turn = await consumeProviderStream(
      providerStream([event.slice(0, midpoint), event.slice(midpoint), "data: [DONE]\n\n"]),
      sink,
      context,
    );

    expect(turn.content).toBe("split");
  });

  it("reports a provider error instead of returning a usable turn", async () => {
    const { sink } = createSink();

    const turn = await consumeProviderStream(
      providerStream([
        `data: ${JSON.stringify({ error: { message: "Quota exceeded" } })}\n\n`,
        textDelta("never read"),
      ]),
      sink,
      context,
    );

    expect(turn.error).toEqual({ message: "Quota exceeded" });
    expect(turn.content).toBe("");
  });

  it("collects streamed openai tool call arguments into one call", async () => {
    const { sink } = createSink();

    const turn = await consumeProviderStream(
      providerStream([
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, id: "call-1", function: { name: "get_weather", arguments: '{"loc' } },
                ],
              },
            },
          ],
        })}\n\n`,
        `data: ${JSON.stringify({
          choices: [
            { delta: { tool_calls: [{ index: 0, function: { arguments: 'ation":"SF"}' } }] } },
          ],
        })}\n\n`,
        "data: [DONE]\n\n",
      ]),
      sink,
      context,
    );

    expect(turn.toolCalls).toEqual([
      {
        id: "call-1",
        type: "function",
        function: { name: "get_weather", arguments: '{"location":"SF"}' },
      },
    ]);
  });
});
