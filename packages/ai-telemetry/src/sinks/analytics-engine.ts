import type { AnalyticsEngineDataset } from "@cloudflare/workers-types";
import {
  readNumberField,
  readNumberFieldAlias,
  readStringField,
} from "@ngriffin_uk/polychat-utility-server/record-fields";

import type { TelemetryEnv, TelemetryMetric, TelemetrySink } from "../types.js";
import {
  ANALYTICS_ENGINE_BLOB_COLUMNS,
  ANALYTICS_ENGINE_DOUBLE_COLUMNS,
  type AnalyticsEngineBlobColumn,
  type AnalyticsEngineDoubleColumn,
  ANALYTICS_ENGINE_INDEX_COLUMN,
} from "./dataset-layout.js";

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
      const properties = event.properties || {};
      const metric = {
        traceId:
          typeof properties.traceId === "string" && properties.traceId
            ? properties.traceId
            : event.distinctId,
        timestamp: now(),
        type: event.category,
        name: event.name,
        value: typeof event.value === "number" ? event.value : 1,
        metadata: {
          distinctId: event.distinctId,
          ...(event.label !== undefined ? { label: event.label } : {}),
          ...(event.nonInteraction !== undefined ? { nonInteraction: event.nonInteraction } : {}),
          ...properties,
        },
        status:
          typeof properties.status === "string" && properties.status
            ? properties.status
            : "success",
        error:
          typeof properties.error === "string" && properties.error ? properties.error : undefined,
      };

      writeAnalyticsEngineMetric(dataset, metric);
    },
    recordMetric(metric) {
      writeAnalyticsEngineMetric(dataset, metric);
    },
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
    metadata: JSON.stringify(metadata),
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
