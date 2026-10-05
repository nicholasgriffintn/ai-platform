import { describe, expect, it, vi } from "vitest";

import { createCollector, operationalSpan } from "../../test/otlp.js";
import { normaliseOtlpId } from "../ids.js";
import { getOtlpConfig } from "../otlp-config.js";
import { createOtlpHttpSink, OtlpExportError } from "../otlp-http.js";
import { createWorkerTelemetry } from "../telemetry.js";
import type { BeaconFetcher } from "../types.js";

describe("native OTLP export", () => {
  it("exports AI operations without content, personal identity or raw failures", async () => {
    const { requests, fetcher } = createCollector();
    const pending: Promise<unknown>[] = [];
    const telemetry = createWorkerTelemetry({
      env: { OTEL_EXPORTER_OTLP_ENDPOINT: "https://collector.test/tenant/", ENV: "test" },
      executionCtx: {
        waitUntil: (task) => {
          pending.push(task);
        },
      },
      fetcher,
      now: () => 2000,
    });

    telemetry.captureAiGeneration({
      traceId: "private-conversation",
      spanId: "private-span",
      parentSpanId: "parent-span",
      user: { id: 7, email: "private@example.test" },
      userTrackingEnabled: true,
      input: [{ role: "user", content: "private prompt" }],
      output: { role: "assistant", content: "private reply" },
      model: "gpt-5",
      provider: "openai",
      latencyMs: 250,
      usage: { prompt_tokens: 12, completion_tokens: 8 },
      toolsCalled: ["private-tool"],
      error: { message: "private credential=secret" },
      properties: { arbitrary: "private property" },
    });
    telemetry.captureAiEmbedding({
      traceId: "private-conversation",
      spanId: "embedding-span",
      input: "private document",
      model: "embedding-model",
      provider: "cloudflare",
      latencyMs: 10,
      inputTokens: 3,
    });
    telemetry.log({
      timestamp: 2000,
      level: "error",
      message: "private log",
      attributes: { provider: "openai", credential: "private credential" },
    });
    telemetry.recordMetric({
      traceId: "private-conversation",
      timestamp: 2000,
      type: "performance",
      name: "chat_run_recovery",
      value: 1,
      status: "success",
      error: "private metric error",
      distinctId: "private user",
      metadata: { provider: "openai", prompt: "private metric prompt" },
    });
    telemetry
      .startSpan("private span name", {
        traceId: "private-conversation",
        attributes: { model: "gpt-5", output: "private span output" },
      })
      .end({ error: new Error("private failure") });
    await telemetry.flush();
    await Promise.all(pending);
    const exported = requests.map((request) => request.body).join("\n");

    expect(exported).not.toContain("private");
    expect(exported).not.toContain("trace.id");
    expect(exported).not.toContain("statusMessage");
    expect(exported).toContain("gen_ai.usage.input_tokens");
    expect(exported).toContain("polychat.ai.operation.duration_seconds");
    expect(exported).toContain(await normaliseOtlpId("private-conversation", "trace"));
    expect(exported).toContain(await normaliseOtlpId("parent-span", "span"));
    expect(requests.map((request) => request.url).sort()).toEqual([
      "https://collector.test/tenant/v1/logs",
      "https://collector.test/tenant/v1/metrics",
      "https://collector.test/tenant/v1/traces",
    ]);
  });

  it("exports through Worker waitUntil without an explicit flush", async () => {
    const { requests, fetcher } = createCollector();
    const pending: Promise<unknown>[] = [];
    const telemetry = createWorkerTelemetry({
      env: { OTEL_EXPORTER_OTLP_ENDPOINT: "https://collector.test" },
      fetcher,
      executionCtx: {
        waitUntil: (task) => {
          pending.push(task);
        },
      },
    });

    telemetry.captureAiGeneration({ traceId: "run", provider: "openai", model: "gpt-5" });
    await Promise.all(pending);
    expect(requests.map((request) => request.url)).toEqual(["https://collector.test/v1/traces"]);
  });

  it("honours the AI observability switch and keeps arbitrary analytics out of OTLP", async () => {
    const { requests, fetcher } = createCollector();
    const telemetry = createWorkerTelemetry({
      env: {
        OTEL_EXPORTER_OTLP_ENDPOINT: "https://collector.test",
        AI_OBSERVABILITY_ENABLED: "false",
      },
      fetcher,
    });

    telemetry.captureAiGeneration({ traceId: "trace", model: "model" });
    telemetry.capture({
      name: "custom",
      category: "analytics",
      distinctId: "user",
      properties: { content: "secret" },
    });
    await telemetry.flush();
    expect(requests).toEqual([]);
  });

  it("joins concurrent flushes and drains records captured during an export", async () => {
    const collector = createCollector();
    let release: (() => void) | undefined;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetcher = vi.fn<BeaconFetcher>(async (url, init) => {
      await ready;

      return collector.fetcher(url, init);
    });
    const sink = createOtlpHttpSink({
      endpoint: "https://collector.test",
      serviceName: "polychat",
      fetcher,
    });

    sink.exportSpan?.(operationalSpan);
    const first = sink.flush?.();
    const second = sink.flush?.();

    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    sink.exportSpan?.({ ...operationalSpan, spanId: "second" });
    release?.();
    await Promise.all([first, second]);
    expect(collector.requests).toHaveLength(2);
    expect(collector.requests[0]?.body).toContain(
      await normaliseOtlpId(operationalSpan.spanId, "span"),
    );
    expect(collector.requests[1]?.body).toContain(await normaliseOtlpId("second", "span"));
  });

  it("caps pending records and snapshots admitted values", async () => {
    const { requests, fetcher } = createCollector();
    const onError = vi.fn();
    const sink = createOtlpHttpSink({
      endpoint: "https://collector.test",
      serviceName: "polychat",
      fetcher,
      maxBufferedRecords: 1,
      maxBufferedBytes: 1000,
      onError,
    });
    const span = { ...operationalSpan, attributes: { model: "original" } };

    sink.exportSpan?.(span);
    span.attributes.model = "mutated";
    sink.exportSpan?.({ ...operationalSpan, spanId: "dropped" });
    await sink.flush?.();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.body).toContain("original");
    expect(requests[0]?.body).not.toContain("mutated");
    expect(onError).toHaveBeenCalledTimes(1);
    sink.exportSpan?.({ ...operationalSpan, attributes: { huge: "x".repeat(1000) } });
    await sink.flush?.();
    expect(requests).toHaveLength(1);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("retries transient responses without replaying a successful signal batch", async () => {
    let traceAttempts = 0;
    const fetcher = vi.fn<BeaconFetcher>(
      async (url): Promise<Response> =>
        new Response("{}", {
          status: url.endsWith("traces") && ++traceAttempts === 1 ? 429 : 200,
          headers: { "Retry-After": "0" },
        }),
    );
    const sink = createOtlpHttpSink({
      endpoint: "https://collector.test",
      serviceName: "polychat",
      fetcher,
    });

    sink.exportSpan?.(operationalSpan);
    sink.log?.({ timestamp: 1000, level: "info", message: "operation" });
    await sink.flush?.();
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("traces"))).toHaveLength(2);
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("logs"))).toHaveLength(1);
    expect(fetcher.mock.calls.every(([, init]) => init.redirect === "error")).toBe(true);
  });

  it.each([400, 401, 500])("does not retry permanent HTTP %s failures", async (status) => {
    const fetcher = vi.fn<BeaconFetcher>(
      async () => new Response("private server details", { status }),
    );
    const onError = vi.fn();
    const sink = createOtlpHttpSink({
      endpoint: "https://collector.test",
      serviceName: "polychat",
      fetcher,
      onError,
    });

    sink.exportSpan?.(operationalSpan);
    await sink.flush?.();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(new OtlpExportError(status));
    expect(String(onError.mock.calls[0]?.[0])).not.toContain("private");
  });

  it("reports partial rejection without retrying accepted data or exporting the server message", async () => {
    const fetcher = vi.fn<BeaconFetcher>(async () =>
      Response.json({
        partialSuccess: {
          rejectedSpans: "1",
          errorMessage: "private server content",
        },
      }),
    );
    const onError = vi.fn();
    const sink = createOtlpHttpSink({
      endpoint: "https://collector.test",
      serviceName: "polychat",
      fetcher,
      onError,
    });

    sink.exportSpan?.(operationalSpan);
    await sink.flush?.();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(new Error("OTLP collector rejected part of the export"));
  });

  it("times out a collector that never completes its response body", async () => {
    const fetcher = vi.fn<BeaconFetcher>(async () => new Response(new ReadableStream()));
    const onError = vi.fn();
    const sink = createOtlpHttpSink({
      endpoint: "https://collector.test",
      serviceName: "polychat",
      fetcher,
      onError,
      timeoutMs: 10,
      sleep: async () => {},
    });

    sink.exportSpan?.(operationalSpan);
    await sink.flush?.();
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenCalledWith(new OtlpExportError());
  });

  it("limits timeout retries and sanitises network failures", async () => {
    const fetcher = vi.fn<BeaconFetcher>(
      async (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => reject(new Error("private transport error")),
            { once: true },
          );
        }),
    );
    const onError = vi.fn();
    const sink = createOtlpHttpSink({
      endpoint: "https://collector.test",
      serviceName: "polychat",
      fetcher,
      onError,
      timeoutMs: 10,
      sleep: async () => {},
    });

    sink.exportSpan?.(operationalSpan);
    const pending = sink.flush?.();

    await pending;
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenCalledWith(new OtlpExportError());
  });
});

describe("OTLP configuration", () => {
  it("accepts encoded collector credentials without changing the collector path", () => {
    expect(
      getOtlpConfig({
        OTEL_EXPORTER_OTLP_ENDPOINT: "https://collector.test/team",
        OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Bearer%20token%2Cvalue,x-api-key=a%3Db",
      }),
    ).toEqual({
      endpoint: "https://collector.test/team",
      serviceName: "polychat-api",
      headers: { authorization: "Bearer token,value", "x-api-key": "a=b" },
    });
  });

  it.each([
    "http://collector.test",
    "https://localhost",
    "https://127.0.0.1",
    "https://user:secret@collector.test",
    "https://collector.test?token=secret",
    "https://collector.test/#secret",
  ])("disables unsafe collector configuration %s", (endpoint) => {
    expect(getOtlpConfig({ OTEL_EXPORTER_OTLP_ENDPOINT: endpoint })).toBeNull();
  });

  it("fails closed on malformed or duplicate credential headers", () => {
    expect(
      getOtlpConfig({
        OTEL_EXPORTER_OTLP_ENDPOINT: "https://collector.test",
        OTEL_EXPORTER_OTLP_HEADERS: "authorization=secret,Authorization=other",
      }),
    ).toBeNull();
    expect(
      getOtlpConfig({
        OTEL_EXPORTER_OTLP_ENDPOINT: "https://collector.test",
        OTEL_EXPORTER_OTLP_HEADERS: "authorization=%0Asecret",
      }),
    ).toBeNull();
  });
});
