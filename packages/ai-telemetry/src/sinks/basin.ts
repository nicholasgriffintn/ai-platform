import type { ExecutionContext } from "@cloudflare/workers-types";
import {
  readBooleanField,
  readStringField,
  secondsToMilliseconds,
} from "@ngriffin_uk/polychat-utility-core";
import { readEnvString } from "@ngriffin_uk/polychat-utility-server/env";
import {
  readNumberField,
  readNumberFieldAlias,
} from "@ngriffin_uk/polychat-utility-server/record-fields";

import { getLogger } from "../logger.js";
import type {
  TelemetryEnv,
  TelemetryEvent,
  TelemetryMetric,
  TelemetryRecord,
  TelemetryRecordContext,
  TelemetrySink,
} from "../types.js";

const logger = getLogger({ prefix: "ai-telemetry/basin" });

const SERVER_APP = "api";
const UNKNOWN_ENVIRONMENT = "unknown";
const AI_EVENT_PREFIX = "$ai_";

const PROMOTED_PROPERTIES = new Set([
  "$ai_trace_id",
  "$ai_session_id",
  "$ai_span_id",
  "$ai_parent_id",
  "$ai_provider",
  "$ai_model",
  "$ai_latency",
  "$ai_time_to_first_token",
  "$ai_input_tokens",
  "$ai_output_tokens",
  "$ai_cache_read_input_tokens",
  "$ai_cache_creation_input_tokens",
  "$ai_reasoning_tokens",
  "$ai_stream",
  "$ai_stop_reason",
  "$ai_http_status",
  "$ai_tool_call_count",
  "$ai_is_error",
  "$ai_error",
  "feature_flag.key",
  "feature_flag.result.variant",
  "status",
  "error",
  "label",
  "path",
]);

const PROMOTED_PERSON_PROPERTIES = new Set(["user_id", "anonymous_id", "plan_id"]);

function remainingProperties(
  metadata: Record<string, unknown>,
  person: Record<string, unknown>,
): Record<string, unknown> | null {
  const entries = [
    ...Object.entries(person).filter(([key]) => !PROMOTED_PERSON_PROPERTIES.has(key)),
    ...Object.entries(metadata).filter(([key]) => !PROMOTED_PROPERTIES.has(key)),
  ].filter(([, value]) => value !== undefined);

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function readUserId(value: string | number | boolean | null | undefined): number | null {
  const userId = typeof value === "string" ? Number(value) : value;

  return typeof userId === "number" && Number.isSafeInteger(userId) ? userId : null;
}

function metricFromEvent(event: TelemetryEvent, timestamp: number): TelemetryMetric {
  const properties = event.properties ?? {};
  const isAiEvent = event.name.startsWith(AI_EVENT_PREFIX);

  return {
    traceId:
      readStringField(properties, "$ai_trace_id") ?? readStringField(properties, "traceId") ?? "",
    timestamp,
    type: event.category,
    name: event.name,
    value: typeof event.value === "number" ? event.value : 1,
    distinctId: event.distinctId,
    personProperties: event.personProperties,
    metadata: {
      ...properties,
      ...(event.label !== undefined ? { label: event.label } : {}),
      ...(event.nonInteraction !== undefined ? { nonInteraction: event.nonInteraction } : {}),
    },
    status: isAiEvent
      ? properties.$ai_is_error === true
        ? "error"
        : "success"
      : (readStringField(properties, "status") ?? "success"),
    error: readStringField(properties, isAiEvent ? "$ai_error" : "error"),
  };
}

export function toTelemetryRecord(
  metric: TelemetryMetric,
  context: TelemetryRecordContext,
): TelemetryRecord {
  const metadata = metric.metadata;
  const person = metric.personProperties ?? {};
  const userId = readUserId(person.user_id);
  const anonymousId = typeof person.anonymous_id === "string" ? person.anonymous_id : null;

  return {
    event_id: crypto.randomUUID(),
    timestamp: metric.timestamp,
    environment: context.environment,
    app: context.app,
    app_version: context.appVersion ?? null,
    source: context.source,
    event_type: metric.type,
    event_name: metric.name,
    status: metric.status || null,
    error_message: metric.error ?? null,
    value: Number.isFinite(metric.value) ? metric.value : null,
    label: readStringField(metadata, "label") ?? null,
    distinct_id: metric.distinctId ?? null,
    user_id: userId,
    anonymous_id: anonymousId,
    plan_id: typeof person.plan_id === "string" ? person.plan_id : null,
    authenticated: userId !== null,
    session_id: context.sessionId ?? readStringField(metadata, "$ai_session_id") ?? null,
    trace_id: metric.traceId || null,
    span_id: readStringField(metadata, "$ai_span_id") ?? null,
    parent_span_id: readStringField(metadata, "$ai_parent_id") ?? null,
    path: context.path ?? readStringField(metadata, "path") ?? null,
    country: context.country ?? null,
    ai_provider:
      readStringField(metadata, "$ai_provider") ?? readStringField(metadata, "provider") ?? null,
    ai_model: readStringField(metadata, "$ai_model") ?? readStringField(metadata, "model") ?? null,
    ai_latency_ms:
      secondsToMilliseconds(readNumberField(metadata, "$ai_latency")) ??
      readNumberFieldAlias(metadata, ["latencyMs", "latency"]) ??
      null,
    ai_time_to_first_token_ms:
      secondsToMilliseconds(readNumberField(metadata, "$ai_time_to_first_token")) ?? null,
    ai_input_tokens: readNumberFieldAlias(metadata, ["$ai_input_tokens", "input_tokens"]) ?? null,
    ai_output_tokens:
      readNumberFieldAlias(metadata, ["$ai_output_tokens", "output_tokens"]) ?? null,
    ai_cached_input_tokens:
      readNumberFieldAlias(metadata, ["$ai_cache_read_input_tokens", "cached_input_tokens"]) ??
      null,
    ai_cache_creation_tokens:
      readNumberFieldAlias(metadata, [
        "$ai_cache_creation_input_tokens",
        "cache_creation_tokens",
      ]) ?? null,
    ai_reasoning_tokens:
      readNumberFieldAlias(metadata, ["$ai_reasoning_tokens", "reasoning_tokens"]) ?? null,
    ai_stream: readBooleanField(metadata, "$ai_stream") ?? null,
    ai_stop_reason: readStringField(metadata, "$ai_stop_reason") ?? null,
    ai_http_status: readNumberField(metadata, "$ai_http_status") ?? null,
    ai_tool_call_count: readNumberField(metadata, "$ai_tool_call_count") ?? null,
    flag_key: readStringField(metadata, "feature_flag.key") ?? null,
    flag_variant: readStringField(metadata, "feature_flag.result.variant") ?? null,
    properties: remainingProperties(metadata, person),
  };
}

export function serverRecordContext(env: TelemetryEnv): TelemetryRecordContext {
  return {
    environment: readEnvString(env.ENV) ?? UNKNOWN_ENVIRONMENT,
    app: SERVER_APP,
    source: "server",
  };
}

export function createBasinSink(
  env: TelemetryEnv,
  executionCtx: ExecutionContext | undefined,
  now: () => number,
): TelemetrySink | null {
  const stream = env.TELEMETRY_STREAM;

  if (!stream) {
    return null;
  }

  const context = serverRecordContext(env);
  let pending: TelemetryRecord[] = [];
  let scheduled: Promise<void> | null = null;

  const flush = async () => {
    scheduled = null;
    const records = pending;

    pending = [];

    if (records.length === 0) {
      return;
    }

    try {
      await stream.send(records);
    } catch (error) {
      logger.warn("Failed to send telemetry to Basin", {
        error: error instanceof Error ? error.message : String(error),
        records: records.length,
      });
    }
  };

  const enqueue = (metric: TelemetryMetric) => {
    pending.push(toTelemetryRecord(metric, context));

    if (scheduled) {
      return;
    }

    scheduled = Promise.resolve().then(flush);
    executionCtx?.waitUntil(scheduled);
  };

  return {
    name: "basin",
    capture: (event) => enqueue(metricFromEvent(event, now())),
    recordMetric: enqueue,
    flush,
  };
}
