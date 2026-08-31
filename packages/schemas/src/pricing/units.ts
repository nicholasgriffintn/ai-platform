import z from "zod/v4";

export const MODEL_TOKEN_UNITS = [
  "input_tokens",
  "output_tokens",
  "cached_input_tokens",
  "cache_write_5m_tokens",
  "cache_write_1h_tokens",
  "reasoning_tokens",
  "audio_input_tokens",
  "audio_output_tokens",
  "image_input_tokens",
  "video_input_tokens",
  "tool_use_prompt_tokens",
] as const;

export const HOSTED_TOOL_UNITS = [
  "web_search_requests",
  "web_fetch_requests",
  "code_execution_seconds",
  "file_search_requests",
  "computer_use_requests",
  "image_generation_calls",
  "search_sources",
  "search_queries",
  "grounded_requests",
  "search_units",
] as const;

export const CAPABILITY_UNITS = [
  "images",
  "video_seconds",
  "audio_seconds",
  "characters",
  "pages",
  "embedding_tokens",
  "transcription_seconds",
  "speech_characters",
  "requests",
] as const;

export const INFRASTRUCTURE_UNITS = [
  "container_vcpu_seconds",
  "container_gib_seconds",
  "container_disk_gb_seconds",
  "container_egress_gb",
  "do_requests",
  "do_gb_seconds",
  "do_rows_read",
  "do_rows_written",
  "d1_rows_read",
  "d1_rows_written",
  "r2_class_a_ops",
  "r2_class_b_ops",
  "r2_gb_month",
  "vectorize_queried_dimensions",
  "vectorize_stored_dimensions",
  "queue_operations",
  "worker_requests",
  "worker_cpu_ms",
  "ai_neurons",
  "analytics_data_points",
] as const;

export const DIRECT_COST_UNIT = "usd_micros";

export const USAGE_UNITS = [
  ...MODEL_TOKEN_UNITS,
  ...HOSTED_TOOL_UNITS,
  ...CAPABILITY_UNITS,
  ...INFRASTRUCTURE_UNITS,
  DIRECT_COST_UNIT,
] as const;

export type UsageUnit = (typeof USAGE_UNITS)[number];

export const usageUnitSchema = z.enum(USAGE_UNITS);

export function isUsageUnit(value: unknown): value is UsageUnit {
  return typeof value === "string" && (USAGE_UNITS as readonly string[]).includes(value);
}
