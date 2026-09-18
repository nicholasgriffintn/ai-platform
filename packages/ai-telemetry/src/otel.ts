import type {
  TelemetryLogLevel,
  TelemetryLogRecord,
  TelemetryMetric,
  TelemetrySink,
  TelemetrySpan,
} from "./types.js";

export type OtlpAnyValue =
  | { stringValue: string }
  | { intValue: string }
  | { doubleValue: number }
  | { boolValue: boolean }
  | { arrayValue: { values: OtlpAnyValue[] } }
  | { kvlistValue: { values: OtlpKeyValue[] } };

export type OtlpKeyValue = { key: string; value: OtlpAnyValue };

export interface OtlpResource {
  attributes: OtlpKeyValue[];
}

export interface OtlpScope {
  name: string;
  version?: string;
}

export interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OtlpKeyValue[];
  status: { code: number; message?: string };
}

export interface OtlpLogRecord {
  timeUnixNano: string;
  severityNumber: number;
  severityText: string;
  body: OtlpAnyValue;
  attributes: OtlpKeyValue[];
  traceId?: string;
  spanId?: string;
}

export interface OtlpMetric {
  name: string;
  gauge: {
    dataPoints: Array<{
      timeUnixNano: string;
      asDouble: number;
      attributes: OtlpKeyValue[];
    }>;
  };
}

export interface OtlpExportRequest {
  resourceSpans?: Array<{
    resource: OtlpResource;
    scopeSpans: Array<{ scope: OtlpScope; spans: OtlpSpan[] }>;
  }>;
  resourceLogs?: Array<{
    resource: OtlpResource;
    scopeLogs: Array<{ scope: OtlpScope; logRecords: OtlpLogRecord[] }>;
  }>;
  resourceMetrics?: Array<{
    resource: OtlpResource;
    scopeMetrics: Array<{ scope: OtlpScope; metrics: OtlpMetric[] }>;
  }>;
}

const SEVERITY: Record<TelemetryLogLevel, { number: number; text: string }> = {
  trace: { number: 1, text: "TRACE" },
  debug: { number: 5, text: "DEBUG" },
  info: { number: 9, text: "INFO" },
  warn: { number: 13, text: "WARN" },
  error: { number: 17, text: "ERROR" },
};

export function toOtlpValue(value: unknown): OtlpAnyValue {
  if (typeof value === "string") {
    return { stringValue: value };
  }

  if (typeof value === "boolean") {
    return { boolValue: value };
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value };
  }

  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toOtlpValue) } };
  }

  if (value && typeof value === "object") {
    return { kvlistValue: { values: toOtlpAttributes(value as Record<string, unknown>) } };
  }

  return { stringValue: String(value) };
}

export function toOtlpAttributes(attributes: Record<string, unknown>): OtlpKeyValue[] {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => ({ key, value: toOtlpValue(value) }));
}

function unixNano(milliseconds: number): string {
  return (BigInt(Math.round(milliseconds)) * 1_000_000n).toString();
}

export function toOtlpSpan(span: TelemetrySpan): OtlpSpan {
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId,
    name: span.name,
    kind: 1,
    startTimeUnixNano: unixNano(span.startTime),
    endTimeUnixNano: unixNano(span.endTime),
    attributes: toOtlpAttributes(span.attributes),
    status: {
      code: span.status === "error" ? 2 : span.status === "ok" ? 1 : 0,
      ...(span.statusMessage ? { message: span.statusMessage } : {}),
    },
  };
}

export function toOtlpLogRecord(record: TelemetryLogRecord): OtlpLogRecord {
  const severity = SEVERITY[record.level];

  return {
    timeUnixNano: unixNano(record.timestamp),
    severityNumber: severity.number,
    severityText: severity.text,
    body: { stringValue: record.message },
    attributes: toOtlpAttributes({
      ...(record.prefix ? { "log.prefix": record.prefix } : {}),
      ...record.attributes,
    }),
    ...(record.traceId ? { traceId: record.traceId } : {}),
    ...(record.spanId ? { spanId: record.spanId } : {}),
  };
}

export function toOtlpMetric(metric: TelemetryMetric): OtlpMetric {
  return {
    name: metric.name,
    gauge: {
      dataPoints: [
        {
          timeUnixNano: unixNano(metric.timestamp),
          asDouble: metric.value,
          attributes: toOtlpAttributes({
            "metric.type": metric.type,
            "metric.status": metric.status,
            "trace.id": metric.traceId,
            ...(metric.error ? { "metric.error": metric.error } : {}),
            ...metric.metadata,
          }),
        },
      ],
    },
  };
}

export interface OtlpResourceOptions {
  serviceName: string;
  serviceVersion?: string;
  attributes?: Record<string, unknown>;
  scope?: OtlpScope;
}

export function toOtlpExportRequest(
  options: OtlpResourceOptions,
  batch: { spans?: TelemetrySpan[]; logs?: TelemetryLogRecord[]; metrics?: TelemetryMetric[] },
): OtlpExportRequest {
  const resource: OtlpResource = {
    attributes: toOtlpAttributes({
      "service.name": options.serviceName,
      ...(options.serviceVersion ? { "service.version": options.serviceVersion } : {}),
      ...options.attributes,
    }),
  };
  const scope = options.scope ?? { name: "@ngriffin_uk/polychat-ai-telemetry" };
  const request: OtlpExportRequest = {};

  if (batch.spans?.length) {
    request.resourceSpans = [
      { resource, scopeSpans: [{ scope, spans: batch.spans.map(toOtlpSpan) }] },
    ];
  }

  if (batch.logs?.length) {
    request.resourceLogs = [
      { resource, scopeLogs: [{ scope, logRecords: batch.logs.map(toOtlpLogRecord) }] },
    ];
  }

  if (batch.metrics?.length) {
    request.resourceMetrics = [
      { resource, scopeMetrics: [{ scope, metrics: batch.metrics.map(toOtlpMetric) }] },
    ];
  }

  return request;
}

export interface OtlpHttpSinkOptions extends OtlpResourceOptions {
  endpoint: string;
  headers?: Record<string, string>;
  fetcher?: (input: string, init: RequestInit) => Promise<Response>;
  onError?: (error: unknown) => void;
}

export function createOtlpHttpSink(options: OtlpHttpSinkOptions): TelemetrySink {
  const fetcher = options.fetcher ?? fetch;
  const spans: TelemetrySpan[] = [];
  const logs: TelemetryLogRecord[] = [];
  const metrics: TelemetryMetric[] = [];
  const endpoint = options.endpoint.replace(/\/$/, "");

  const post = async (path: string, body: OtlpExportRequest) => {
    const response = await fetcher(`${endpoint}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...options.headers },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`OTLP export to ${path} failed with ${response.status}`);
    }
  };

  return {
    name: "otlp",
    exportSpan: (span) => void spans.push(span),
    log: (record) => void logs.push(record),
    recordMetric: (metric) => void metrics.push(metric),
    flush: async () => {
      const pending = {
        spans: spans.splice(0),
        logs: logs.splice(0),
        metrics: metrics.splice(0),
      };
      const exports: Array<Promise<void>> = [];

      if (pending.spans.length) {
        exports.push(post("/v1/traces", toOtlpExportRequest(options, { spans: pending.spans })));
      }

      if (pending.logs.length) {
        exports.push(post("/v1/logs", toOtlpExportRequest(options, { logs: pending.logs })));
      }

      if (pending.metrics.length) {
        exports.push(
          post("/v1/metrics", toOtlpExportRequest(options, { metrics: pending.metrics })),
        );
      }

      try {
        await Promise.all(exports);
      } catch (error) {
        if (!options.onError) {
          throw error;
        }

        options.onError(error);
      }
    },
  };
}
