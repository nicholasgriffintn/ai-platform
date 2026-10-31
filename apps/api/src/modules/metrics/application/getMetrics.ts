import {
  getLogger,
  TELEMETRY_NAMESPACE,
  TELEMETRY_TABLE,
} from "@ngriffin_uk/polychat-ai-telemetry";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { isSimpleSqlLiteral } from "@ngriffin_uk/polychat-utility-server/sql";
import z from "zod/v4";

import type { IEnv } from "~/types";

const logger = getLogger({ prefix: "modules/metrics/getMetrics" });

const HOUR_MS = 60 * 60 * 1000;

const METRIC_COLUMNS = [
  "event_id",
  "timestamp",
  "environment",
  "app",
  "app_version",
  "source",
  "event_type",
  "event_name",
  "status",
  "error_message",
  "value",
  "label",
  "distinct_id",
  "user_id",
  "anonymous_id",
  "plan_id",
  "authenticated",
  "session_id",
  "trace_id",
  "span_id",
  "parent_span_id",
  "path",
  "country",
  "ai_provider",
  "ai_model",
  "ai_latency_ms",
  "ai_time_to_first_token_ms",
  "ai_input_tokens",
  "ai_output_tokens",
  "ai_cached_input_tokens",
  "ai_cache_creation_tokens",
  "ai_reasoning_tokens",
  "ai_stream",
  "ai_stop_reason",
  "ai_http_status",
  "ai_tool_call_count",
  "flag_key",
  "flag_variant",
  "properties",
] as const;

const basinSqlResponseSchema = z.object({
  success: z.boolean(),
  errors: z.array(z.object({ code: z.number().optional(), message: z.string() })).optional(),
  result: z.object({ rows: z.array(z.record(z.string(), z.unknown())).default([]) }).nullish(),
});

export interface MetricsQueryOptions {
  limit: number;
  timeframeHours: number;
  environment?: string;
  app?: string;
  type?: string;
  status?: string;
}

function buildMetricsFilter(column: string, value?: string): string {
  if (!value) {
    return "";
  }

  if (!isSimpleSqlLiteral(value)) {
    throw new AssistantError(`Invalid metrics filter value: ${value}`, ErrorType.PARAMS_ERROR);
  }

  return ` AND ${column} = '${value}'`;
}

export function buildMetricsQuery(options: MetricsQueryOptions, now: number): string {
  const since = now - options.timeframeHours * HOUR_MS;

  return `SELECT ${METRIC_COLUMNS.join(", ")}
FROM ${TELEMETRY_NAMESPACE}.${TELEMETRY_TABLE}
WHERE timestamp > ${since}${buildMetricsFilter("environment", options.environment)}${buildMetricsFilter("app", options.app)}${buildMetricsFilter("event_type", options.type)}${buildMetricsFilter("status", options.status)}
ORDER BY timestamp DESC
LIMIT ${options.limit}`;
}

export async function getMetrics(
  env: IEnv,
  options: MetricsQueryOptions,
): Promise<Record<string, unknown>[]> {
  if (!env.ACCOUNT_ID || !env.BASIN_SQL_API_TOKEN || !env.TELEMETRY_CATALOG_BUCKET) {
    throw new AssistantError(
      "Telemetry querying is not configured: set ACCOUNT_ID, BASIN_SQL_API_TOKEN and TELEMETRY_CATALOG_BUCKET",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const now = Date.now();
  const response = await fetch(
    `https://api.sql.cloudflarestorage.com/api/v1/accounts/${env.ACCOUNT_ID}/basin-sql/query/${env.TELEMETRY_CATALOG_BUCKET}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.BASIN_SQL_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        warehouse: `${env.ACCOUNT_ID}_${env.TELEMETRY_CATALOG_BUCKET}`,
        query: buildMetricsQuery(options, now),
      }),
    },
  );
  const parsed = basinSqlResponseSchema.safeParse(await response.json().catch(() => null));

  if (!response.ok || !parsed.success || !parsed.data.success) {
    logger.error("Basin SQL metrics query failed", {
      status: response.status,
      errors: parsed.success ? parsed.data.errors : parsed.error.message,
    });
    throw new AssistantError("Failed to fetch metrics from Basin SQL");
  }

  return (parsed.data.result?.rows ?? []).map((row) => ({
    ...row,
    minutesAgo:
      typeof row.timestamp === "number" ? Math.floor((now - row.timestamp) / 60_000) : null,
  }));
}
