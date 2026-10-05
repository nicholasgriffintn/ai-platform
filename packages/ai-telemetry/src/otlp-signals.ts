import {
  readNumberField,
  readStringField,
} from "@ngriffin_uk/polychat-utility-server/record-fields";

import { AI_EMBEDDING_EVENT_NAME, AI_GENERATION_EVENT_NAME } from "./constants.js";
import { createSpanId, createTraceId } from "./ids.js";
import type {
  TelemetryEvent,
  TelemetryLogRecord,
  TelemetryMetric,
  TelemetrySpan,
} from "./types.js";

const OPERATIONAL_ATTRIBUTES = new Set([
  "provider",
  "model",
  "operation",
  "outcome",
  "httpStatus",
  "stream",
  "gen_ai.operation.name",
  "gen_ai.provider.name",
  "gen_ai.request.model",
  "gen_ai.usage.input_tokens",
  "gen_ai.usage.output_tokens",
  "gen_ai.usage.cache_read.input_tokens",
  "gen_ai.usage.cache_creation.input_tokens",
  "gen_ai.request.temperature",
  "gen_ai.request.max_tokens",
  "http.response.status_code",
  "polychat.ai.tool_call_count",
  "polychat.ai.streaming",
  "error.type",
]);

const AI_FIELDS = [
  ["$ai_provider", "gen_ai.provider.name"],
  ["$ai_model", "gen_ai.request.model"],
  ["$ai_input_tokens", "gen_ai.usage.input_tokens"],
  ["$ai_output_tokens", "gen_ai.usage.output_tokens"],
  ["$ai_cache_read_input_tokens", "gen_ai.usage.cache_read.input_tokens"],
  ["$ai_cache_creation_input_tokens", "gen_ai.usage.cache_creation.input_tokens"],
  ["$ai_temperature", "gen_ai.request.temperature"],
  ["$ai_max_tokens", "gen_ai.request.max_tokens"],
  ["$ai_http_status", "http.response.status_code"],
  ["$ai_tool_call_count", "polychat.ai.tool_call_count"],
  ["$ai_stream", "polychat.ai.streaming"],
] as const;

export function selectOperationalAttributes(
  input: Record<string, unknown> = {},
): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (!OPERATIONAL_ATTRIBUTES.has(key)) {
      continue;
    }

    if (
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value) && value >= 0) ||
      (typeof value === "string" && /^[a-zA-Z0-9_./:-]{1,160}$/.test(value))
    ) {
      attributes[key] = value;
    }
  }

  return attributes;
}

export function sanitiseOperationalSpan(span: TelemetrySpan): TelemetrySpan {
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId,
    name: /^[a-zA-Z][a-zA-Z0-9_.:-]{0,79}$/.test(span.name) ? span.name : "polychat.operation",
    startTime: span.startTime,
    endTime: span.endTime,
    status: span.status,
    attributes: selectOperationalAttributes(span.attributes),
  };
}

export function sanitiseOperationalMetric(metric: TelemetryMetric): TelemetryMetric {
  return {
    traceId: "",
    timestamp: metric.timestamp,
    type: /^[a-zA-Z][a-zA-Z0-9_.:-]{0,39}$/.test(metric.type) ? metric.type : "operational",
    name: /^[a-zA-Z][a-zA-Z0-9_.:-]{0,99}$/.test(metric.name) ? metric.name : "polychat.operation",
    value: metric.value,
    metadata: selectOperationalAttributes(metric.metadata),
    status: ["success", "error", "info", "pending", "cancelled", "skipped"].includes(metric.status)
      ? metric.status
      : "unknown",
  };
}

export function sanitiseOperationalLog(record: TelemetryLogRecord): TelemetryLogRecord {
  return {
    timestamp: record.timestamp,
    level: record.level,
    message: "Polychat operational log",
    traceId: record.traceId,
    spanId: record.spanId,
    attributes: selectOperationalAttributes(record.attributes),
  };
}

export function buildOtlpAiSignals(
  event: TelemetryEvent,
  timestamp: number,
): {
  span: TelemetrySpan;
  metrics: TelemetryMetric[];
  log?: TelemetryLogRecord;
} | null {
  if (event.name !== AI_GENERATION_EVENT_NAME && event.name !== AI_EMBEDDING_EVENT_NAME) {
    return null;
  }

  const properties = event.properties ?? {};
  const operation = event.name === AI_EMBEDDING_EVENT_NAME ? "embeddings" : "chat";
  const candidates: Record<string, unknown> = { "gen_ai.operation.name": operation };

  for (const [source, target] of AI_FIELDS) {
    candidates[target] = properties[source];
  }

  const error = properties.$ai_is_error === true;

  if (error) {
    candidates["error.type"] = "provider_error";
  }

  const attributes = selectOperationalAttributes(candidates);
  const latency = readNumberField(properties, "$ai_latency");
  const duration = latency !== undefined && latency >= 0 && latency <= 86_400 ? latency : 0;
  const traceId = readStringField(properties, "$ai_trace_id") ?? createTraceId();
  const spanId = readStringField(properties, "$ai_span_id") ?? createSpanId();
  const span: TelemetrySpan = {
    traceId,
    spanId,
    parentSpanId: readStringField(properties, "$ai_parent_id"),
    name: `${operation} ${readStringField(attributes, "gen_ai.request.model") ?? "unknown"}`,
    startTime: Math.max(0, timestamp - duration * 1000),
    endTime: timestamp,
    status: error ? "error" : "ok",
    attributes,
  };
  const metricAttributes = selectOperationalAttributes({
    "gen_ai.operation.name": operation,
    "gen_ai.provider.name": attributes["gen_ai.provider.name"],
    "gen_ai.request.model": attributes["gen_ai.request.model"],
    "error.type": attributes["error.type"],
  });
  const metrics: TelemetryMetric[] = [];
  const addMetric = (name: string, value: number) => {
    metrics.push({
      traceId: "",
      timestamp,
      type: "performance",
      name,
      value,
      metadata: metricAttributes,
      status: error ? "error" : "success",
    });
  };

  if (latency !== undefined && latency >= 0 && latency <= 86_400) {
    addMetric("polychat.ai.operation.duration_seconds", latency);
  }

  for (const [source, name] of [
    ["$ai_input_tokens", "polychat.ai.input_tokens"],
    ["$ai_output_tokens", "polychat.ai.output_tokens"],
    ["$ai_time_to_first_token", "polychat.ai.time_to_first_token_seconds"],
  ] as const) {
    const value = readNumberField(properties, source);

    if (value !== undefined && value >= 0) {
      addMetric(name, value);
    }
  }

  return {
    span,
    metrics,
    log: error
      ? {
          timestamp,
          level: "error",
          message: "GenAI operation failed",
          traceId,
          spanId,
          attributes,
        }
      : undefined,
  };
}
