import type { IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/metrics/getMetrics" });

interface MetricsQueryOptions {
  limit?: number;
  interval?: string;
  timeframe?: string;
  type?: string;
  status?: string;
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

  const buildQuery = () => {
    let baseQuery = `
        SELECT 
            blob1 as type,
            blob2 as name,
            blob3 as status,
            blob4 as error,
            blob5 as traceId,
						blob6 as metadata,
            double1 as value,
            timestamp,
						toStartOfInterval(timestamp, INTERVAL '${queryOptions.interval}' MINUTE) as truncated_time,
						SUM(_sample_interval) as sampleCount
        FROM assistant_analytics
        WHERE timestamp > now() - INTERVAL '${queryOptions.timeframe}' HOUR
        `;

    if (options.type) {
      baseQuery += ` AND blob1 = '${options.type}'`;
    }

    if (options.status) {
      baseQuery += ` AND blob3 = '${options.status}'`;
    }

    baseQuery += `
        GROUP BY 
            blob1, blob2, blob3, blob4, blob5, blob6,
            double1, timestamp
        ORDER BY timestamp DESC
        LIMIT ${queryOptions.limit}
        `;

    return baseQuery;
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
    data: {
      [key: string]: string | number | boolean;
    }[];
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
