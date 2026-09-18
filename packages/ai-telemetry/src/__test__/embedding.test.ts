import { describe, expect, it, vi } from "vitest";

import { withEmbeddingTelemetry } from "../embedding.js";
import { createTelemetry } from "../telemetry.js";
import type { TelemetryEvent, TelemetrySink } from "../types.js";

function recordingSink(): TelemetrySink & { events: TelemetryEvent[] } {
  const events: TelemetryEvent[] = [];

  return {
    name: "recording",
    events,
    capture: (event) => void events.push(event),
  };
}

function createTelemetryWithSink(sink: TelemetrySink, captureContent = true) {
  return createTelemetry({
    sinks: [sink],
    aiObservability: { enabled: true, captureContent },
  });
}

describe("withEmbeddingTelemetry", () => {
  it("emits document and query events while delegating other methods", async () => {
    const sink = recordingSink();
    const insert = vi.fn().mockResolvedValue({ status: "success", error: null });
    const provider = {
      generate: vi.fn().mockResolvedValue([{ id: "vec-1" }]),
      getQuery: vi.fn().mockResolvedValue({ data: [[0.1]], status: { success: true } }),
      insert,
    };
    const wrapped = withEmbeddingTelemetry(provider, {
      telemetry: createTelemetryWithSink(sink),
      identity: { user: { id: 1 } },
      provider: "workers-ai",
      model: "@cf/baai/bge-large-en-v1.5",
      estimateInputTokens: (input) => input.length,
    });

    await wrapped.generate("memory", "hello", "vec-1", {});
    await wrapped.getQuery("query");
    await wrapped.insert([], {});

    expect(insert).toHaveBeenCalledTimes(1);
    expect(sink.events).toHaveLength(2);
    expect(sink.events[0]).toMatchObject({
      name: "$ai_embedding",
      distinctId: "user:1",
      properties: expect.objectContaining({
        $ai_span_name: "embed_document",
        $ai_provider: "workers-ai",
        $ai_model: "@cf/baai/bge-large-en-v1.5",
        $ai_input: "hello",
        $ai_input_tokens: 5,
      }),
    });
    expect(sink.events[1]).toMatchObject({
      properties: expect.objectContaining({ $ai_span_name: "embed_query" }),
    });
  });

  it("captures failures and rethrows the provider error", async () => {
    const sink = recordingSink();
    const wrapped = withEmbeddingTelemetry(
      {
        generate: vi.fn(),
        getQuery: vi.fn().mockRejectedValue(new Error("embedding model unavailable")),
      },
      {
        telemetry: createTelemetryWithSink(sink),
        identity: { user: { id: 1 } },
        provider: "workers-ai",
        model: "@cf/baai/bge-large-en-v1.5",
      },
    );

    await expect(wrapped.getQuery("query")).rejects.toThrow("embedding model unavailable");

    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]?.properties).toMatchObject({
      $ai_span_name: "embed_query",
      $ai_is_error: true,
      $ai_error: "embedding model unavailable",
    });
  });

  it("withholds embedding input when the user disabled tracking", async () => {
    const sink = recordingSink();
    const wrapped = withEmbeddingTelemetry(
      {
        generate: vi.fn(),
        getQuery: vi.fn().mockResolvedValue({ data: [], status: { success: true } }),
      },
      {
        telemetry: createTelemetryWithSink(sink),
        identity: { user: { id: 1 }, userTrackingEnabled: false },
        provider: "workers-ai",
        model: "@cf/baai/bge-large-en-v1.5",
        estimateInputTokens: (input) => input.length,
      },
    );

    await wrapped.getQuery("private query");

    expect(sink.events[0]?.properties).not.toHaveProperty("$ai_input");
  });
});
