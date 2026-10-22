import { describe, expect, it, vi } from "vitest";

import { getOtlpExportConfig } from "../config.js";
import { buildChatRunSpan, chatRunSpanId } from "../gen-ai-spans.js";
import { createOtlpHttpSink, toOtlpSpan } from "../otel.js";
import { createTelemetry } from "../telemetry.js";
import type { TelemetrySpan } from "../types.js";

const RUN_ID = "0f8e5d3c-2b1a-4c9d-8e7f-6a5b4c3d2e1f";

describe("gen_ai spans", () => {
  it("records a chat span under its run with gen_ai attributes and OTLP ids", () => {
    const spans: TelemetrySpan[] = [];
    const telemetry = createTelemetry({
      sinks: [{ name: "memory", exportSpan: (span) => void spans.push(span) }],
      now: () => 10_000,
    });

    telemetry.captureAiGeneration({
      traceId: RUN_ID,
      spanId: "generation-1",
      parentSpanId: chatRunSpanId(RUN_ID),
      sessionId: "conversation-1",
      model: "gpt-5",
      provider: "openai",
      usage: { prompt_tokens: 120, completion_tokens: 30 },
      latencyMs: 2_500,
      stopReason: "stop",
      toolsCalled: ["web_search"],
    });

    const [span] = spans;
    const otlp = toOtlpSpan(span);
    const run = toOtlpSpan(
      buildChatRunSpan({
        runId: RUN_ID,
        conversationId: "conversation-1",
        status: "failed",
        trigger: "schedule",
        startedAt: 1_000,
        endedAt: 12_000,
        agentId: "teammate-context-1",
        terminalReason: "Provider timed out",
      }),
    );

    expect(span).toMatchObject({
      name: "chat gpt-5",
      startTime: 7_500,
      endTime: 10_000,
      attributes: {
        "gen_ai.operation.name": "chat",
        "gen_ai.provider.name": "openai",
        "gen_ai.request.model": "gpt-5",
        "gen_ai.conversation.id": "conversation-1",
        "gen_ai.usage.input_tokens": 120,
        "gen_ai.usage.output_tokens": 30,
        "gen_ai.response.finish_reasons": ["stop"],
        "gen_ai.tool.names": ["web_search"],
      },
    });
    expect(otlp.traceId).toBe(RUN_ID.replaceAll("-", ""));
    expect(otlp.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(otlp.parentSpanId).toBe(run.spanId);
    expect(run).toMatchObject({
      traceId: otlp.traceId,
      name: "invoke_agent teammate-context-1",
      status: { code: 2, message: "Provider timed out" },
    });
  });

  it("flushes buffered spans once per batch when a scheduler is given", async () => {
    const fetcher = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    const scheduled: Array<() => Promise<void>> = [];
    const telemetry = createTelemetry({
      sinks: [
        createOtlpHttpSink({
          endpoint: "https://otel.test",
          serviceName: "polychat-api",
          fetcher,
          scheduleFlush: (flush) => void scheduled.push(flush),
        }),
      ],
    });

    telemetry.startSpan("a").end();
    telemetry.startSpan("b").end();
    await Promise.all(scheduled.map((flush) => flush()));
    telemetry.startSpan("c").end();

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(scheduled).toHaveLength(2);
  });
});

describe("OTLP export config", () => {
  it("needs an https endpoint and reads headers in the OpenTelemetry format", () => {
    expect(getOtlpExportConfig({})).toBeNull();
    expect(getOtlpExportConfig({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel.test" })).toBeNull();
    expect(
      getOtlpExportConfig({
        OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.test/otlp/",
        OTEL_EXPORTER_OTLP_HEADERS: "x-honeycomb-team=abc%3D,broken,authorization=Bearer%20t",
        ENV: "production",
      }),
    ).toEqual({
      endpoint: "https://otel.test/otlp",
      headers: { "x-honeycomb-team": "abc=", authorization: "Bearer t" },
      serviceName: "polychat-api",
      environment: "production",
    });
  });
});
