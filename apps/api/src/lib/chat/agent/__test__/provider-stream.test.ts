import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/providers/models", () => ({
  findModelConfig: vi.fn(async () => ({ modalities: { input: ["text"], output: ["text"] } })),
}));

vi.mock("~/lib/storage/generated-media", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/lib/storage/generated-media")>();

  return {
    ...actual,
    persistBase64GeneratedImages: vi.fn(async (_context: unknown, images: string[]) => ({
      urls: images.map((_image, index) => `https://assets.test/${index}.png`),
      metadata: [],
    })),
  };
});

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

function googleEvent(parts: unknown[]): string {
  return `data: ${JSON.stringify({ candidates: [{ content: { role: "model", parts } }] })}\n\n`;
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

  it("forwards deltas while the provider is still sending, not once it finishes", async () => {
    const { sink, events } = createSink();
    let releaseSecondChunk: () => void = () => {};

    const secondChunkReleased = new Promise<void>((resolve) => {
      releaseSecondChunk = resolve;
    });
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(textDelta("first")));
      },
      async pull(controller) {
        await secondChunkReleased;
        controller.enqueue(encoder.encode(textDelta("second")));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    const turn = consumeProviderStream(stream, sink, context);

    await vi.waitFor(() =>
      expect(events.filter((event) => event.type === "content_block_delta")).toHaveLength(1),
    );

    releaseSecondChunk();

    expect((await turn).content).toBe("firstsecond");
  });

  it("preserves content received before the provider stream disconnects", async () => {
    const { sink } = createSink();
    const encoder = new TextEncoder();
    let sentContent = false;
    const stream = new ReadableStream({
      pull(controller) {
        if (!sentContent) {
          sentContent = true;
          controller.enqueue(encoder.encode(textDelta("partial answer")));

          return;
        }

        controller.error(new Error("upstream disconnected"));
      },
    });

    await expect(consumeProviderStream(stream, sink, context)).resolves.toMatchObject({
      content: "partial answer",
      interrupted: true,
    });
  });

  it("reports streamed usage as the provider sends it", async () => {
    const { sink, events } = createSink();

    const turn = await consumeProviderStream(
      providerStream([
        textDelta("Hello"),
        `data: ${JSON.stringify({
          choices: [{ delta: {} }],
          usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
        })}\n\n`,
        "data: [DONE]\n\n",
      ]),
      sink,
      context,
    );

    expect(turn.usage).toMatchObject({ total_tokens: 14 });
    expect(events.some((event) => event.type === "usage")).toBe(true);
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

  it("preserves content received before a provider error event", async () => {
    const { sink } = createSink();

    const turn = await consumeProviderStream(
      providerStream([
        textDelta("partial answer"),
        `data: ${JSON.stringify({ error: { message: "Upstream disconnected" } })}\n\n`,
      ]),
      sink,
      context,
    );

    expect(turn).toMatchObject({
      content: "partial answer",
      error: null,
      interrupted: true,
    });
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

  it("keeps OpenAI hosted tool results and reasoning summaries in message parts", async () => {
    const { sink, events } = createSink();
    const reasoningItem = {
      id: "reasoning-1",
      type: "reasoning",
      summary: [{ type: "summary_text", text: "Checked the arithmetic." }],
    };
    const codeItem = {
      id: "code-1",
      type: "code_interpreter_call",
      status: "completed",
      code: "print(2 + 2)",
      outputs: [{ type: "logs", logs: "4\n" }],
    };

    const turn = await consumeProviderStream(
      providerStream([
        `data: ${JSON.stringify({
          type: "response.reasoning_summary_text.delta",
          item_id: "reasoning-1",
          delta: "Checked the arithmetic.",
        })}\n\n`,
        `data: ${JSON.stringify({ type: "response.output_item.done", item: reasoningItem })}\n\n`,
        `data: ${JSON.stringify({ type: "response.output_item.done", item: codeItem })}\n\n`,
        `data: ${JSON.stringify({
          type: "response.completed",
          response: { output: [reasoningItem, codeItem] },
        })}\n\n`,
      ]),
      sink,
      context,
    );

    expect(turn.thinking).toBe("Checked the arithmetic.");
    expect(turn.parts).toEqual([
      expect.objectContaining({ type: "reasoning", text: "Checked the arithmetic." }),
      expect.objectContaining({
        type: "tool_use",
        name: "code_execution",
        toolCallId: "code-1",
        input: { code: "print(2 + 2)" },
      }),
      expect.objectContaining({
        type: "tool_result",
        name: "code_execution",
        toolCallId: "code-1",
        content: "4\n",
      }),
    ]);
    expect(events.filter((event) => event.type === "thinking_delta")).toHaveLength(1);
  });

  it("assembles Google code execution chunks into real tool parts", async () => {
    const { sink, events } = createSink();

    const turn = await consumeProviderStream(
      providerStream([
        googleEvent([{ text: "I will calculate it." }]),
        googleEvent([
          {
            executableCode: {
              language: "PYTHON",
              code: "def answer():\n    return ",
              id: "call_google_1",
            },
          },
        ]),
        googleEvent([
          { executableCode: { language: "PYTHON", code: "5117\n", id: "call_google_1" } },
        ]),
        googleEvent([
          {
            codeExecutionResult: {
              outcome: "OUTCOME_OK",
              output: "5117\n",
              id: "call_google_1",
            },
          },
        ]),
      ]),
      sink,
      { ...context, provider: "google-ai-studio", model: "gemini-flash-latest" },
    );

    expect(turn.content).toBe("I will calculate it.");
    expect(turn.content).not.toContain("<artifact");
    expect(turn.parts).toEqual([
      expect.objectContaining({ type: "text", text: "I will calculate it." }),
      expect.objectContaining({
        type: "tool_use",
        name: "code_execution",
        toolCallId: "call_google_1",
        input: { code: "def answer():\n    return 5117\n", language: "python" },
      }),
      expect.objectContaining({
        type: "tool_result",
        name: "code_execution",
        toolCallId: "call_google_1",
        status: "completed",
        content: "5117\n",
        data: {
          responseType: "text",
          providerResult: { outcome: "OUTCOME_OK", output: "5117\n" },
        },
      }),
    ]);
    expect(events.filter((event) => event.type === "content_block_delta")).toHaveLength(1);
  });

  it("preserves Google Search grounding metadata from server-side tool streams", async () => {
    const { sink } = createSink();
    const groundingMetadata = {
      groundingChunks: [
        { web: { uri: "https://ai.google.dev/gemini-api/docs/changelog", title: "Release notes" } },
      ],
      webSearchQueries: ["latest Gemini API release notes"],
    };
    const turn = await consumeProviderStream(
      providerStream([
        googleEvent([
          {
            toolCall: {
              id: "server-search-1",
              name: "google_search",
              args: { query: "latest Gemini API release notes" },
            },
          },
        ]),
        `data: ${JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "The latest release is dated 2026-08-26." }],
              },
              groundingMetadata,
              finishReason: "STOP",
            },
          ],
        })}\n\n`,
      ]),
      sink,
      { ...context, provider: "google-ai-studio", model: "gemini-3.6-flash" },
    );

    const expectedGrounding = {
      ...groundingMetadata,
      searchEntryPoint: {},
      groundingSupports: {},
    };

    expect(turn.content).toBe("The latest release is dated 2026-08-26.");
    expect(turn.structuredData).toEqual({ searchGrounding: expectedGrounding });
    expect(turn.citations).toEqual([{ searchGrounding: expectedGrounding }]);
  });

  it("persists a completed streamed image response as a file part", async () => {
    const { sink } = createSink();
    const imageBase64 = "a".repeat(120_000);
    const imageItem = {
      id: "image-1",
      type: "image_generation_call",
      status: "completed",
      result: imageBase64,
    };
    const completedEvent = `data: ${JSON.stringify({
      type: "response.completed",
      response: { id: "response-1", object: "response", output: [imageItem] },
    })}\n\n`;
    const eventSplit = Math.floor(completedEvent.length / 2);

    const turn = await consumeProviderStream(
      providerStream([
        `data: ${JSON.stringify({ type: "response.output_item.done", item: imageItem })}\n\n`,
        completedEvent.slice(0, eventSplit),
        completedEvent.slice(eventSplit),
      ]),
      sink,
      context,
    );

    expect(turn.parts).toEqual([
      expect.objectContaining({
        type: "tool_use",
        name: "image_generation",
        toolCallId: "image-1",
      }),
      expect.objectContaining({
        type: "tool_result",
        name: "image_generation",
        content: "Image generated.",
      }),
      expect.objectContaining({
        type: "file",
        url: "https://assets.test/0.png",
        mimeType: "image/*",
      }),
    ]);
    expect(turn.structuredData).toMatchObject({
      openai_response_id: "response-1",
      output: [expect.not.objectContaining({ result: imageBase64 })],
    });
  });

  it("waits for Anthropic tool input deltas before completing the call", async () => {
    const { sink } = createSink();

    const turn = await consumeProviderStream(
      providerStream([
        'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu-1","name":"load_skill","input":{}}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"skill\\":\\"arti"}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"facts\\"}"}}\n\n',
        'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      ]),
      sink,
      { ...context, provider: "anthropic", model: "claude-opus-5" },
    );

    expect(turn.toolCalls).toEqual([
      {
        id: "toolu-1",
        type: "function",
        function: { name: "load_skill", arguments: '{"skill":"artifacts"}' },
      },
    ]);
  });

  it("persists Anthropic hosted results through their established presentation contracts", async () => {
    const { sink } = createSink();

    const turn = await consumeProviderStream(
      providerStream([
        'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"server_tool_use","id":"srvtoolu-search","name":"web_search","input":{"query":"Polychat"}}}\n\n',
        'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
        'event: content_block_start\ndata: {"type":"content_block_start","index":1,"content_block":{"type":"web_search_tool_result","tool_use_id":"srvtoolu-search","content":[{"type":"web_search_result","url":"https://polychat.example","title":"Polychat","page_age":null,"encrypted_content":"encrypted"}]}}\n\n',
        'event: content_block_stop\ndata: {"type":"content_block_stop","index":1}\n\n',
        'event: content_block_start\ndata: {"type":"content_block_start","index":2,"content_block":{"type":"server_tool_use","id":"srvtoolu-fetch","name":"web_fetch","input":{"url":"https://example.com"}}}\n\n',
        'event: content_block_stop\ndata: {"type":"content_block_stop","index":2}\n\n',
        'event: content_block_start\ndata: {"type":"content_block_start","index":3,"content_block":{"type":"web_fetch_tool_result","tool_use_id":"srvtoolu-fetch","content":{"type":"web_fetch_result","url":"https://example.com","retrieved_at":"2026-08-31T00:00:00Z","content":{"type":"document","source":{"type":"text","media_type":"text/plain","data":"---\\ntitle: Example Domain\\n---\\n\\n# Example Domain"},"title":"Example Domain"}}}}\n\n',
        'event: content_block_stop\ndata: {"type":"content_block_stop","index":3}\n\n',
        'event: content_block_start\ndata: {"type":"content_block_start","index":4,"content_block":{"type":"server_tool_use","id":"srvtoolu-code","name":"code_execution","input":{"code":"print(6 * 7)"}}}\n\n',
        'event: content_block_stop\ndata: {"type":"content_block_stop","index":4}\n\n',
        'event: content_block_start\ndata: {"type":"content_block_start","index":5,"content_block":{"type":"code_execution_tool_result","tool_use_id":"srvtoolu-code","content":{"type":"code_execution_result","stdout":"42\\n","stderr":"","return_code":0,"content":[]}}}\n\n',
        'event: content_block_stop\ndata: {"type":"content_block_stop","index":5}\n\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      ]),
      sink,
      { ...context, provider: "anthropic", model: "claude-opus-5" },
    );

    expect(turn.toolCalls).toEqual([]);
    expect(turn.structuredData).toEqual({
      searchGrounding: {
        groundingChunks: [{ web: { uri: "https://polychat.example", title: "Polychat" } }],
        webSearchQueries: ["Polychat"],
      },
    });
    expect(turn.parts).toEqual([
      expect.objectContaining({
        type: "tool_use",
        name: "web_fetch",
        toolCallId: "srvtoolu-fetch",
        input: { url: "https://example.com" },
      }),
      expect.objectContaining({
        type: "tool_result",
        name: "web_fetch",
        toolCallId: "srvtoolu-fetch",
        content: "# Example Domain\n\n[Source](https://example.com)",
        data: expect.objectContaining({
          responseType: "text",
          providerResult: expect.objectContaining({ url: "https://example.com" }),
        }),
      }),
      expect.objectContaining({
        type: "tool_use",
        name: "code_execution",
        toolCallId: "srvtoolu-code",
        input: { code: "print(6 * 7)" },
      }),
      expect.objectContaining({
        type: "tool_result",
        name: "code_execution",
        toolCallId: "srvtoolu-code",
        content: "**Standard output**\n\n```text\n42\n```\n\nExit code: 0",
        data: expect.objectContaining({
          responseType: "text",
          providerResult: expect.objectContaining({ stdout: "42\n", return_code: 0 }),
        }),
      }),
    ]);
  });
});
