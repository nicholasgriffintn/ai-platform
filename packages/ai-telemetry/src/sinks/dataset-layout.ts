export const ANALYTICS_ENGINE_DATASET = "assistant_analytics";

export const ANALYTICS_ENGINE_BLOB_COLUMNS = [
  "type",
  "name",
  "status",
  "error",
  "traceId",
  "metadata",
  "provider",
  "model",
] as const;

export const ANALYTICS_ENGINE_DOUBLE_COLUMNS = [
  "value",
  "timestamp",
  "latencyMs",
  "inputTokens",
  "outputTokens",
  "totalTokens",
  "cachedInputTokens",
  "cacheCreationTokens",
  "reasoningTokens",
] as const;

export type AnalyticsEngineBlobColumn = (typeof ANALYTICS_ENGINE_BLOB_COLUMNS)[number];
export type AnalyticsEngineDoubleColumn = (typeof ANALYTICS_ENGINE_DOUBLE_COLUMNS)[number];

export const ANALYTICS_ENGINE_TYPE_COLUMN: AnalyticsEngineBlobColumn = "type";
export const ANALYTICS_ENGINE_STATUS_COLUMN: AnalyticsEngineBlobColumn = "status";

export const ANALYTICS_ENGINE_INDEX_COLUMN: AnalyticsEngineBlobColumn = "name";

export function analyticsEngineBlobColumn(column: AnalyticsEngineBlobColumn): string {
  return `blob${ANALYTICS_ENGINE_BLOB_COLUMNS.indexOf(column) + 1}`;
}

export function analyticsEngineDoubleColumn(column: AnalyticsEngineDoubleColumn): string {
  return `double${ANALYTICS_ENGINE_DOUBLE_COLUMNS.indexOf(column) + 1}`;
}
