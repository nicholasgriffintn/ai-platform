import type { AnalyticsEngineDataset } from "@cloudflare/workers-types";
import { secondsToMilliseconds } from "@ngriffin_uk/polychat-utility-core";
import {
  readNumberField,
  readNumberFieldAlias,
  readStringField,
} from "@ngriffin_uk/polychat-utility-server/record-fields";

import type { TelemetryEnv, TelemetryEvent, TelemetryMetric, TelemetrySink } from "../types.js";
import {
  ANALYTICS_ENGINE_BLOB_COLUMNS,
  ANALYTICS_ENGINE_DOUBLE_COLUMNS,
  type AnalyticsEngineBlobColumn,
  type AnalyticsEngineDoubleColumn,
  ANALYTICS_ENGINE_INDEX_COLUMN,
} from "./dataset-layout.js";

const AI_EVENT_PREFIX = "$ai_";

function aiMetadata(properties: Record<string, unknown>): Record<string, unknown> {
  const inputTokens = readNumberField(properties, "$ai_input_tokens") ?? 0;
  const outputTokens = readNumberField(properties, "$ai_output_tokens") ?? 0;

  return {
    provider: readStringField(properties, "$ai_provider"),
    model: readStringField(properties, "$ai_model"),
    latencyMs: secondsToMilliseconds(readNumberField(properties, "$ai_latency")),
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
    cached_input_tokens: readNumberField(properties, "$ai_cache_read_input_tokens"),
    cache_creation_tokens: readNumberField(properties, "$ai_cache_creation_input_tokens"),
    reasoning_tokens: readNumberField(properties, "$ai_reasoning_tokens"),
  };
}

function metricFromEvent(event: TelemetryEvent, timestamp: number): TelemetryMetric {
  const properties = event.properties ?? {};
  const isAiEvent = event.name.startsWith(AI_EVENT_PREFIX);
  const failed = isAiEvent && properties.$ai_is_error === true;

  return {
    traceId:
      readStringField(properties, "$ai_trace_id") ??
      readStringField(properties, "traceId") ??
      event.distinctId,
    timestamp,
    type: event.category,
    name: event.name,
    value: typeof event.value === "number" ? event.value : 1,
    metadata: {
      distinctId: event.distinctId,
      ...(event.label !== undefined ? { label: event.label } : {}),
      ...(event.nonInteraction !== undefined ? { nonInteraction: event.nonInteraction } : {}),
      ...properties,
      ...(isAiEvent ? aiMetadata(properties) : {}),
    },
    status: isAiEvent
      ? failed
        ? "error"
        : "success"
      : (readStringField(properties, "status") ?? "success"),
    error: isAiEvent
      ? readStringField(properties, "$ai_error")
      : readStringField(properties, "error"),
  };
}

export function createAnalyticsEngineSink(
  env: TelemetryEnv,
  now: () => number,
): TelemetrySink | null {
  const dataset = env.ANALYTICS;

  if (!dataset || typeof dataset.writeDataPoint !== "function") {
    return null;
  }

  return {
    name: "analytics_engine",
    capture(event) {
      writeAnalyticsEngineMetric(dataset, metricFromEvent(event, now()));
    },
    recordMetric(metric) {
      writeAnalyticsEngineMetric(dataset, metric);
    },
  };
}

function analyticsEngineMetadata(metric: TelemetryMetric): Record<string, unknown> {
  return {
    ...metric.metadata,
    ...(metric.distinctId ? { distinctId: metric.distinctId } : {}),
  };
}

function analyticsEngineBlobs(metric: TelemetryMetric): string[] {
  const metadata = metric.metadata;
  const values: Record<AnalyticsEngineBlobColumn, string> = {
    type: metric.type,
    name: metric.name,
    status: metric.status,
    error: metric.error || "None",
    traceId: metric.traceId,
    metadata: JSON.stringify(analyticsEngineMetadata(metric)),
    provider: readStringField(metadata, "provider") ?? "unknown",
    model: readStringField(metadata, "model") ?? "unknown",
  };

  return ANALYTICS_ENGINE_BLOB_COLUMNS.map((column) => values[column]);
}

function analyticsEngineDoubles(metric: TelemetryMetric): number[] {
  const metadata = metric.metadata;
  const values: Record<AnalyticsEngineDoubleColumn, number> = {
    value: metric.value,
    timestamp: metric.timestamp,
    latencyMs: readNumberFieldAlias(metadata, ["latency", "latencyMs"]) ?? 0,
    inputTokens: readNumberField(metadata, "input_tokens") ?? 0,
    outputTokens: readNumberField(metadata, "output_tokens") ?? 0,
    totalTokens: readNumberField(metadata, "total_tokens") ?? 0,
    cachedInputTokens: readNumberField(metadata, "cached_input_tokens") ?? 0,
    cacheCreationTokens: readNumberField(metadata, "cache_creation_tokens") ?? 0,
    reasoningTokens: readNumberField(metadata, "reasoning_tokens") ?? 0,
  };

  return ANALYTICS_ENGINE_DOUBLE_COLUMNS.map((column) => values[column]);
}

export function writeAnalyticsEngineMetric(
  analyticsEngine: AnalyticsEngineDataset,
  metric: TelemetryMetric,
): void {
  const blobs = analyticsEngineBlobs(metric);

  analyticsEngine.writeDataPoint({
    blobs,
    doubles: analyticsEngineDoubles(metric),
    indexes: [blobs[ANALYTICS_ENGINE_BLOB_COLUMNS.indexOf(ANALYTICS_ENGINE_INDEX_COLUMN)]],
  });
}
