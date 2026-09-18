import { describe, expect, it } from "vitest";

import { createMetricsRecorder } from "../metrics.js";
import { createTelemetry } from "../telemetry.js";
import type { TelemetryEvent, TelemetrySink } from "../types.js";

function captureOnlySink(): TelemetrySink & { events: TelemetryEvent[] } {
  const events: TelemetryEvent[] = [];

  return {
    name: "capture-only",
    events,
    capture: (event) => void events.push(event),
  };
}

describe("telemetry identity", () => {
  it("attributes embeddings to the shared user distinct id and person profile", () => {
    const sink = captureOnlySink();
    const telemetry = createTelemetry({
      sinks: [sink],
      aiObservability: { enabled: true, captureContent: false },
    });

    telemetry.captureAiEmbedding({
      traceId: "trace-1",
      spanId: "span-1",
      spanName: "embed_document",
      model: "@cf/baai/bge-large-en-v1.5",
      provider: "workers-ai",
      input: "secret document",
      latencyMs: 120,
      user: { id: 1 },
    });

    expect(sink.events[0]).toMatchObject({
      name: "$ai_embedding",
      category: "ai_observability",
      distinctId: "user:1",
      personProperties: { user_id: "1" },
      properties: expect.objectContaining({
        $ai_trace_id: "trace-1",
        $ai_span_id: "span-1",
        $ai_span_name: "embed_document",
        $ai_model: "@cf/baai/bge-large-en-v1.5",
        $ai_provider: "workers-ai",
        $ai_latency: 0.12,
      }),
    });
    expect(sink.events[0]?.properties).not.toHaveProperty("$ai_input");
  });

  it("withholds embedding input when the user disabled tracking", () => {
    const sink = captureOnlySink();
    const telemetry = createTelemetry({
      sinks: [sink],
      aiObservability: { enabled: true, captureContent: true },
    });

    telemetry.captureAiEmbedding({
      traceId: "trace-1",
      spanId: "span-1",
      model: "@cf/baai/bge-large-en-v1.5",
      provider: "workers-ai",
      input: "private document",
      user: { id: 1 },
      userTrackingEnabled: false,
    });

    expect(sink.events[0]?.properties).not.toHaveProperty("$ai_input");
  });

  it("prefers the shared distinct id over the trace id and keeps trace ids when identity is unknown", () => {
    const sink = captureOnlySink();
    const recorder = createMetricsRecorder(createTelemetry({ sinks: [sink] }));

    recorder.trackUsageMetric({ anonymousUserId: "anon-1" }, "balance");
    recorder.recordMetric({
      traceId: "trace-1",
      type: "performance",
      name: "turn_continuity_finished",
      value: 1,
      metadata: {},
      status: "success",
    });

    expect(sink.events[0]).toMatchObject({
      name: "balance",
      distinctId: "anonymous:anon-1",
      personProperties: { anonymous_id: "anon-1" },
    });
    expect(sink.events[1]).toMatchObject({
      name: "turn_continuity_finished",
      distinctId: "trace-1",
    });
  });

  it("attaches person properties to AI generation events", () => {
    const sink = captureOnlySink();
    const telemetry = createTelemetry({
      sinks: [sink],
      aiObservability: { enabled: true, captureContent: false },
    });

    telemetry.captureAiGeneration({
      traceId: "trace-1",
      model: "claude-sonnet-5",
      provider: "anthropic",
      user: { id: 1, email: "person@example.com" },
    });

    expect(sink.events[0]).toMatchObject({
      name: "$ai_generation",
      distinctId: "user:1",
      personProperties: { user_id: "1", email: "person@example.com" },
    });
  });
});
