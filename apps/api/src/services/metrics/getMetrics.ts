import {
  ANALYTICS_ENGINE_BLOB_COLUMNS,
  ANALYTICS_ENGINE_DATASET,
  ANALYTICS_ENGINE_DOUBLE_COLUMNS,
  ANALYTICS_ENGINE_STATUS_COLUMN,
  ANALYTICS_ENGINE_TYPE_COLUMN,
  analyticsEngineBlobColumn,
  analyticsEngineDoubleColumn,
} from "~/lib/analytics/dataset-layout";
import type { IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { isSimpleSqlLiteral } from "~/utils/sql";

const logger = getLogger({ prefix: "services/metrics/getMetrics" });

interface MetricsQueryOptions {
  limit?: number;
  interval?: string;
  timeframe?: string;
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

export const handleGetMetrics = async (
  req: IRequest,
  options: MetricsQueryOptions,
): Promise<Record<string, any>[]> => {
  const { env } = req;

  if (!env.ANALYTICS || !env.ACCOUNT_ID || !env.ANALYTICS_API_KEY) {
    throw new AssistantError(
      "Analytics configuration is incomplete: missing Analytics Engine, Account ID, or API Key",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const queryOptions = {
    limit: Math.min(options.limit || 100, 500),
    interval: options.interval || "1",
    timeframe: options.timeframe || "24",
  };

  const projectedColumns = [
    ...ANALYTICS_ENGINE_BLOB_COLUMNS.map((column) => analyticsEngineBlobColumn(column)),
    ...ANALYTICS_ENGINE_DOUBLE_COLUMNS.map((column) => analyticsEngineDoubleColumn(column)),
  ];
  const selectedColumns = [
    ...ANALYTICS_ENGINE_BLOB_COLUMNS.map(
      (column) => `${analyticsEngineBlobColumn(column)} as ${column}`,
    ),
    ...ANALYTICS_ENGINE_DOUBLE_COLUMNS.map(
      (column) => `${analyticsEngineDoubleColumn(column)} as ${column}`,
    ),
  ];

  const buildQuery = () => {
    return `
        SELECT
            ${selectedColumns.join(",\n            ")},
            timestamp,
            toStartOfInterval(timestamp, INTERVAL '${queryOptions.interval}' MINUTE) as truncated_time,
            SUM(_sample_interval) as sampleCount
        FROM ${ANALYTICS_ENGINE_DATASET}
        WHERE timestamp > now() - INTERVAL '${queryOptions.timeframe}' HOUR${buildMetricsFilter(
          analyticsEngineBlobColumn(ANALYTICS_ENGINE_TYPE_COLUMN),
          options.type,
        )}${buildMetricsFilter(analyticsEngineBlobColumn(ANALYTICS_ENGINE_STATUS_COLUMN), options.status)}
        GROUP BY
            ${projectedColumns.join(", ")}, timestamp
        ORDER BY timestamp DESC
        LIMIT ${queryOptions.limit}
        `;
  };

  const query = buildQuery();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/analytics_engine/sql?query=${encodeURIComponent(query)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.ANALYTICS_API_KEY}`,
      },
    },
  );

  if (!response.ok) {
    logger.error("Error querying Analytics Engine:", await response.text());
    throw new AssistantError("Failed to fetch metrics from Analytics Engine");
  }

  const metricsResponse = (await response.json()) as {
    meta: {
      name: string;
      type: string;
    }[];
    data: Record<string, string | number | boolean>[];
  };

  if (!metricsResponse.data) {
    throw new AssistantError("No metrics found in Analytics Engine");
  }

  return metricsResponse.data.map((item) => ({
    ...item,
    minutesAgo: Math.floor(
      (Date.now() - new Date(item.timestamp as string).getTime()) / (1000 * 60),
    ),
  }));
};
