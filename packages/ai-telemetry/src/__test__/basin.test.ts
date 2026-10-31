import { describe, expect, it, vi } from "vitest";

import { createBasinSink, toTelemetryRecord } from "../sinks/basin.js";
import type { TelemetryRecord } from "../types.js";

function harness() {
  const send = vi.fn<(records: TelemetryRecord[]) => Promise<void>>(async () => {});
  const waitUntil = vi.fn();
  const sink = createBasinSink(
    { TELEMETRY_STREAM: { send }, ENV: "staging" },
    { waitUntil } as never,
    () => 1_756_600_000_000,
  );

  return { send, waitUntil, sink };
}

describe("createBasinSink", () => {
  it("is disabled without a stream binding", () => {
    expect(createBasinSink({}, undefined, Date.now)).toBeNull();
  });

  it("maps AI generations onto typed columns and sends one batch per turn", async () => {
    const { send, waitUntil, sink } = harness();

    sink?.capture?.({
      name: "$ai_generation",
      category: "ai_observability",
      distinctId: "user:7",
      personProperties: { user_id: "7", plan_id: "pro", email: "a@example.com" },
      properties: {
        $ai_trace_id: "trace-1",
        $ai_provider: "anthropic",
        $ai_model: "claude-sonnet-5",
        $ai_latency: 0.812,
        $ai_input_tokens: 1000,
        $ai_output_tokens: 500,
        $ai_stream: true,
        $ai_input: [{ role: "user", content: "hi" }],
        conversation_id: "conversation-1",
      },
    });
    sink?.recordMetric?.({
      traceId: "trace-2",
      timestamp: 1_756_600_000_001,
      type: "performance",
      name: "rag",
      value: 12,
      status: "success",
      metadata: {},
    });

    expect(waitUntil).toHaveBeenCalledTimes(1);
    await waitUntil.mock.calls[0]?.[0];

    expect(send).toHaveBeenCalledTimes(1);
    const [generation, rag] = send.mock.calls[0]?.[0] ?? [];

    expect(generation).toMatchObject({
      timestamp: 1_756_600_000_000,
      environment: "staging",
      app: "api",
      source: "server",
      event_type: "ai_observability",
      event_name: "$ai_generation",
      status: "success",
      user_id: 7,
      plan_id: "pro",
      authenticated: true,
      trace_id: "trace-1",
      ai_provider: "anthropic",
      ai_model: "claude-sonnet-5",
      ai_latency_ms: 812,
      ai_input_tokens: 1000,
      ai_output_tokens: 500,
      ai_stream: true,
      properties: {
        email: "a@example.com",
        $ai_input: [{ role: "user", content: "hi" }],
        conversation_id: "conversation-1",
      },
    });
    expect(rag).toMatchObject({ event_name: "rag", ai_provider: null, properties: null });
  });

  it("swallows stream failures so telemetry never breaks a request", async () => {
    const { send, waitUntil, sink } = harness();

    send.mockRejectedValueOnce(new Error("stream unavailable"));
    sink?.recordMetric?.({
      traceId: "trace-3",
      timestamp: 1,
      type: "error",
      name: "boom",
      value: 1,
      status: "error",
      metadata: {},
    });

    await expect(waitUntil.mock.calls[0]?.[0]).resolves.toBeUndefined();
  });
});

describe("toTelemetryRecord", () => {
  it("records client context and flag exposures", () => {
    const record = toTelemetryRecord(
      {
        traceId: "",
        timestamp: 1,
        type: "experiment",
        name: "$feature_flag_called",
        value: 1,
        status: "success",
        metadata: { "feature_flag.key": "chat-tone", "feature_flag.result.variant": "playful" },
      },
      {
        environment: "preview",
        app: "desktop",
        source: "client",
        appVersion: "0.6.7",
        sessionId: "session-1",
        path: "/c/1",
        country: "GB",
      },
    );

    expect(record).toMatchObject({
      environment: "preview",
      app: "desktop",
      source: "client",
      app_version: "0.6.7",
      session_id: "session-1",
      path: "/c/1",
      country: "GB",
      trace_id: null,
      authenticated: false,
      flag_key: "chat-tone",
      flag_variant: "playful",
    });
  });
});
