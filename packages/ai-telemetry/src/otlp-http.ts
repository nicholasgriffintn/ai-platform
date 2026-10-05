import { createBoundedBuffer } from "@ngriffin_uk/polychat-utility-core";
import { getUtf8ByteLength } from "@ngriffin_uk/polychat-utility-server/strings";

import { normaliseOtlpId } from "./ids.js";
import { toOtlpExportRequest, type OtlpResourceOptions } from "./otel.js";
import { createOtlpTransport } from "./otlp-transport.js";

export { OtlpExportError } from "./otlp-transport.js";

import { parseOtlpEndpoint } from "./otlp-config.js";
import type { TelemetryLogRecord, TelemetryMetric, TelemetrySink, TelemetrySpan } from "./types.js";

export interface OtlpHttpSinkOptions extends OtlpResourceOptions {
  endpoint: string;
  headers?: Record<string, string>;
  fetcher?: (input: string, init: RequestInit) => Promise<Response>;
  onError?: (error: unknown) => void;
  maxBufferedRecords?: number;
  maxBufferedBytes?: number;
  timeoutMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  autoFlush?: boolean;
  waitUntil?: (promise: Promise<void>) => void;
}

type PendingSignal =
  | { kind: "span"; value: TelemetrySpan }
  | { kind: "log"; value: TelemetryLogRecord }
  | { kind: "metric"; value: TelemetryMetric };

async function normaliseBatch(records: PendingSignal[]) {
  const spans: TelemetrySpan[] = [];
  const logs: TelemetryLogRecord[] = [];
  const metrics: TelemetryMetric[] = [];

  await Promise.all(
    records.map(async (record) => {
      if (record.kind === "span") {
        const span = record.value;

        spans.push({
          ...span,
          traceId: await normaliseOtlpId(span.traceId, "trace"),
          spanId: await normaliseOtlpId(span.spanId, "span"),
          parentSpanId: span.parentSpanId
            ? await normaliseOtlpId(span.parentSpanId, "span")
            : undefined,
        });
      } else if (record.kind === "log") {
        const log = record.value;

        logs.push({
          ...log,
          traceId: log.traceId ? await normaliseOtlpId(log.traceId, "trace") : undefined,
          spanId: log.spanId ? await normaliseOtlpId(log.spanId, "span") : undefined,
        });
      } else {
        metrics.push(record.value);
      }
    }),
  );

  return { spans, logs, metrics };
}

export function createOtlpHttpSink(options: OtlpHttpSinkOptions): TelemetrySink {
  const endpoint = parseOtlpEndpoint(options.endpoint);
  const timeoutMs = options.timeoutMs ?? 5000;

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) {
    throw new RangeError("OTLP timeout must be between 1 and 10000 milliseconds");
  }

  const buffer = createBoundedBuffer<PendingSignal>({
    maxItems: options.maxBufferedRecords ?? 256,
    maxWeight: options.maxBufferedBytes ?? 1_048_576,
  });
  let inFlight: Promise<void> | undefined;
  let scheduled = false;

  const post = createOtlpTransport(options, endpoint, timeoutMs);

  const drain = async () => {
    while (buffer.size) {
      const batch = await normaliseBatch(buffer.drain());
      const exports: Promise<void>[] = [];

      if (batch.spans.length) {
        exports.push(post("v1/traces", toOtlpExportRequest(options, { spans: batch.spans })));
      }

      if (batch.logs.length) {
        exports.push(post("v1/logs", toOtlpExportRequest(options, { logs: batch.logs })));
      }

      if (batch.metrics.length) {
        exports.push(post("v1/metrics", toOtlpExportRequest(options, { metrics: batch.metrics })));
      }

      const results = await Promise.allSettled(exports);

      for (const result of results) {
        if (result.status === "rejected") {
          if (options.onError) {
            options.onError(result.reason);
          } else {
            throw result.reason;
          }
        }
      }
    }
  };

  const flush = (): Promise<void> => {
    if (!inFlight) {
      inFlight = drain().finally(() => {
        inFlight = undefined;
        if (options.autoFlush && buffer.size) {
          schedule();
        }
      });
    }

    return inFlight;
  };

  const schedule = () => {
    if (scheduled) {
      return;
    }

    scheduled = true;
    const task = Promise.resolve()
      .then(() => {
        scheduled = false;

        return flush();
      })
      .catch((error) => options.onError?.(error));

    options.waitUntil?.(task);
  };

  const enqueue = (record: PendingSignal) => {
    const size = getUtf8ByteLength(JSON.stringify(record));

    if (!buffer.add(structuredClone(record), size)) {
      const error = new Error("OTLP buffer capacity reached; record dropped");

      if (options.onError) {
        options.onError(error);
      } else {
        throw error;
      }

      return;
    }

    if (options.autoFlush) {
      schedule();
    }
  };

  return {
    name: "otlp",
    exportSpan: (value) => enqueue({ kind: "span", value }),
    log: (value) => enqueue({ kind: "log", value }),
    recordMetric: (value) => enqueue({ kind: "metric", value }),
    flush,
  };
}
