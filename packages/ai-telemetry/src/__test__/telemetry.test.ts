import { describe, expect, it, vi } from "vitest";

import { getLogger, onLogRecord } from "../logger.js";
import { createOtlpHttpSink, toOtlpExportRequest, toOtlpSpan } from "../otel.js";
import { createTelemetry } from "../telemetry.js";
import type { TelemetrySink } from "../types.js";

function recordingSink(name = "memory"): TelemetrySink & { seen: unknown[] } {
  const seen: unknown[] = [];

  return {
    name,
    seen,
    capture: (event) => void seen.push({ kind: "event", event }),
    recordMetric: (metric) => void seen.push({ kind: "metric", metric }),
    exportSpan: (span) => void seen.push({ kind: "span", span }),
    log: (record) => void seen.push({ kind: "log", record }),
    captureTrainingExample: async (signal) => void seen.push({ kind: "training", signal }),
  };
}

describe("createTelemetry", () => {
  it("fans events, metrics, spans, and training examples out to every sink", async () => {
    const sink = recordingSink();
    const plain: TelemetrySink = { name: "plain", capture: vi.fn() };
    const telemetry = createTelemetry({ sinks: [sink, plain], now: () => 1_000 });

    telemetry.capture({ name: "chat.sent", category: "chat", distinctId: "u1" });
    telemetry.recordMetric({
      traceId: "t1",
      timestamp: 1_000,
      type: "performance",
      name: "latency",
      value: 12,
      metadata: {},
      status: "success",
    });

    const span = telemetry.startSpan("provider.call", { attributes: { provider: "openai" } });

    span.setAttribute("model", "gpt-5");
    const ended = span.end();

    await telemetry.captureTrainingExample({
      source: "chat",
      appName: "polychat",
      userPrompt: "hi",
      assistantResponse: "hello",
    });

    expect(sink.seen.map((entry) => (entry as { kind: string }).kind)).toEqual([
      "event",
      "metric",
      "span",
      "training",
    ]);
    expect(ended).toMatchObject({
      name: "provider.call",
      status: "ok",
      attributes: { provider: "openai", model: "gpt-5" },
      startTime: 1_000,
      endTime: 1_000,
    });
    expect(plain.capture).toHaveBeenCalledTimes(2);
    expect(plain.capture).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "latency", category: "performance", value: 12 }),
    );
  });

  it("captures AI content only when the user allows training data", () => {
    const sink = recordingSink();
    const telemetry = createTelemetry({
      sinks: [sink],
      aiObservability: { enabled: true },
    });
    const signal = {
      traceId: "t1",
      model: "gpt-5",
      provider: "openai",
      input: [{ role: "user", content: "secret" }],
      output: { role: "assistant", content: "answer" },
      user: { id: 7 },
      userTrackingEnabled: false,
    };

    telemetry.captureAiGeneration(signal);

    const fallback: TelemetrySink = { name: "events", capture: vi.fn() };
    const eventsOnly = createTelemetry({
      sinks: [fallback],
      aiObservability: { enabled: true },
    });

    eventsOnly.captureAiGeneration(signal);
    eventsOnly.captureAiGeneration({
      ...signal,
      user: undefined,
      userTrackingEnabled: true,
    });
    eventsOnly.captureAiGeneration({ ...signal, userTrackingEnabled: true });

    const [withoutConsent, anonymousOptIn, authenticatedOptIn] = vi
      .mocked(fallback.capture!)
      .mock.calls.map((call) => call[0].properties ?? {});

    expect(JSON.stringify(withoutConsent)).not.toContain("secret");
    expect(JSON.stringify(anonymousOptIn)).not.toContain("secret");
    expect(JSON.stringify(authenticatedOptIn)).toContain("secret");

    const disabled = createTelemetry({
      sinks: [fallback],
      aiObservability: { enabled: false },
    });

    disabled.captureAiGeneration(signal);
    expect(fallback.capture).toHaveBeenCalledTimes(3);
  });

  it("isolates sink failures and reports them", () => {
    const onSinkError = vi.fn();
    const telemetry = createTelemetry({
      sinks: [
        {
          name: "broken",
          capture: () => {
            throw new Error("down");
          },
        },
      ],
      onSinkError,
    });

    expect(() => telemetry.capture({ name: "x", category: "y", distinctId: "z" })).not.toThrow();
    expect(onSinkError).toHaveBeenCalledWith("broken", expect.any(Error));
  });
});

describe("logger telemetry", () => {
  it("forwards log records with attributes to listeners", () => {
    const records: unknown[] = [];
    const off = onLogRecord((record) => void records.push(record));

    getLogger({ prefix: "test" }).error("broke", { attempt: 2 }, new Error("boom"));
    off();
    getLogger({ prefix: "test" }).error("ignored");

    expect(records).toEqual([
      expect.objectContaining({
        level: "error",
        prefix: "test",
        message: "broke",
        attributes: { attempt: 2, error: expect.objectContaining({ message: "boom" }) },
      }),
    ]);
  });
});

describe("OpenTelemetry formatting", () => {
  it("renders spans, logs and metrics as OTLP JSON", () => {
    const request = toOtlpExportRequest(
      { serviceName: "polychat-api", serviceVersion: "1.0.0" },
      {
        spans: [
          {
            traceId: "a".repeat(32),
            spanId: "b".repeat(16),
            name: "provider.call",
            startTime: 1_000,
            endTime: 1_250,
            status: "error",
            statusMessage: "timeout",
            attributes: { model: "gpt-5", retries: 2, ratio: 0.5, tags: ["a"] },
          },
        ],
        logs: [{ timestamp: 1_000, level: "warn", message: "slow", prefix: "chat" }],
        metrics: [
          {
            traceId: "t",
            timestamp: 1_000,
            type: "performance",
            name: "latency",
            value: 250,
            metadata: { provider: "openai" },
            status: "success",
          },
        ],
      },
    );

    expect(request.resourceSpans?.[0]?.resource.attributes).toEqual([
      { key: "service.name", value: { stringValue: "polychat-api" } },
      { key: "service.version", value: { stringValue: "1.0.0" } },
    ]);
    expect(request.resourceSpans?.[0]?.scopeSpans[0]?.spans[0]).toMatchObject({
      startTimeUnixNano: "1000000000",
      endTimeUnixNano: "1250000000",
      status: { code: 2, message: "timeout" },
      attributes: expect.arrayContaining([
        { key: "retries", value: { intValue: "2" } },
        { key: "ratio", value: { doubleValue: 0.5 } },
        { key: "tags", value: { arrayValue: { values: [{ stringValue: "a" }] } } },
      ]),
    });
    expect(request.resourceLogs?.[0]?.scopeLogs[0]?.logRecords[0]).toMatchObject({
      severityNumber: 13,
      severityText: "WARN",
      body: { stringValue: "slow" },
    });
    expect(
      request.resourceMetrics?.[0]?.scopeMetrics[0]?.metrics[0]?.gauge.dataPoints[0],
    ).toMatchObject({
      asDouble: 250,
    });
  });

  it("batches signals and exports them on flush", async () => {
    const fetcher = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    const sink = createOtlpHttpSink({
      endpoint: "https://otel.test/",
      serviceName: "polychat-api",
      headers: { authorization: "Bearer x" },
      fetcher,
    });
    const telemetry = createTelemetry({ sinks: [sink], now: () => 5 });

    telemetry.startSpan("s").end();
    telemetry.log({ timestamp: 5, level: "info", message: "m" });
    await telemetry.flush();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      "https://otel.test/v1/traces",
      "https://otel.test/v1/logs",
    ]);
    expect(
      JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)).resourceSpans[0].scopeSpans[0].spans[0],
    ).toEqual(
      toOtlpSpan({
        traceId: expect.any(String),
        spanId: expect.any(String),
        name: "s",
        startTime: 5,
        endTime: 5,
        status: "ok",
        attributes: {},
      }),
    );
  });
});
