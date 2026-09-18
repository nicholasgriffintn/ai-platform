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
  it("attributes metrics to the shared user distinct id and person profile", () => {
    const sink = captureOnlySink();
    const recorder = createMetricsRecorder(createTelemetry({ sinks: [sink] }));

    recorder.trackTokenUsage({
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
      provider: "anthropic",
      model: "claude-sonnet-5",
      userId: 1,
      completion_id: "completion-1",
      streamed: true,
    });

    expect(sink.events[0]).toMatchObject({
      name: "ai_token_usage",
      category: "usage",
      distinctId: "user:1",
      personProperties: { user_id: "1" },
    });
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
