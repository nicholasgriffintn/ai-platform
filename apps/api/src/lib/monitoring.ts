import type { AnalyticsEngineDataset } from "@cloudflare/workers-types";

import { AssistantError } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "MONITORING" });

export interface Metric {
  traceId: string;
  timestamp: number;
  type: "performance" | "error" | "usage" | "guardrail";
  name: string;
  value: number;
  metadata: Record<string, any>;
  status: "success" | "error" | "info";
  error?: string;
}

export class Monitoring {
  private static instance: Monitoring;
  private analyticsEngine: AnalyticsEngineDataset;

  constructor(analyticsEngine: AnalyticsEngineDataset) {
    this.analyticsEngine = analyticsEngine;
  }

  public static getInstance(
    analyticsEngine?: AnalyticsEngineDataset,
  ): Monitoring {
    if (!Monitoring.instance) {
      if (!analyticsEngine) {
        throw new AssistantError(
          "Analytics Engine not configured",
          ErrorType.CONFIGURATION_ERROR,
        );
      }
      Monitoring.instance = new Monitoring(analyticsEngine);
    }
    return Monitoring.instance;
  }

  public async recordMetric(
    metricName: string,
    value: number,
    labels: Record<string, string> = {},
  ): Promise<void> {
    try {
      await this.analyticsEngine.writeDataPoint({
        blobs: [metricName],
        doubles: [value],
        indexes: [labels.userId || "anonymous"],
      });
    } catch (error) {
      logger.error("Failed to record metric", {
        metricName,
        value,
        labels,
        error,
      });
    }
  }

  /**
   * Track database query performance
   */
  public async trackQueryPerformance(
    query: string,
    duration: number,
    success: boolean,
    userId?: string,
  ): Promise<void> {
    const queryType = this.extractQueryType(query);
    
    await this.recordMetric("db_query_duration", duration, {
      queryType,
      success: success.toString(),
      userId: userId || "anonymous",
    });

    // Track slow queries separately
    if (duration > 1000) {
      await this.recordMetric("db_slow_query", duration, {
        queryType,
        userId: userId || "anonymous",
      });
    }
  }

  /**
   * Track API endpoint performance
   */
  public async trackEndpointPerformance(
    endpoint: string,
    method: string,
    duration: number,
    statusCode: number,
    userId?: string,
  ): Promise<void> {
    await this.recordMetric("api_request_duration", duration, {
      endpoint,
      method,
      statusCode: statusCode.toString(),
      userId: userId || "anonymous",
    });

    // Track errors separately
    if (statusCode >= 400) {
      await this.recordMetric("api_error", 1, {
        endpoint,
        method,
        statusCode: statusCode.toString(),
        userId: userId || "anonymous",
      });
    }
  }

  /**
   * Track cache hit/miss rates
   */
  public async trackCacheMetrics(
    cacheKey: string,
    hit: boolean,
    duration?: number,
  ): Promise<void> {
    await this.recordMetric("cache_operation", 1, {
      operation: hit ? "hit" : "miss",
      keyType: this.extractCacheKeyType(cacheKey),
    });

    if (duration) {
      await this.recordMetric("cache_operation_duration", duration, {
        operation: hit ? "hit" : "miss",
        keyType: this.extractCacheKeyType(cacheKey),
      });
    }
  }

  /**
   * Track external API calls
   */
  public async trackExternalApiCall(
    provider: string,
    endpoint: string,
    duration: number,
    success: boolean,
    userId?: string,
  ): Promise<void> {
    await this.recordMetric("external_api_duration", duration, {
      provider,
      endpoint,
      success: success.toString(),
      userId: userId || "anonymous",
    });

    if (!success) {
      await this.recordMetric("external_api_error", 1, {
        provider,
        endpoint,
        userId: userId || "anonymous",
      });
    }
  }

  private extractQueryType(query: string): string {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.startsWith("select")) return "SELECT";
    if (normalizedQuery.startsWith("insert")) return "INSERT";
    if (normalizedQuery.startsWith("update")) return "UPDATE";
    if (normalizedQuery.startsWith("delete")) return "DELETE";
    return "OTHER";
  }

  private extractCacheKeyType(key: string): string {
    const parts = key.split(":");
    return parts[0] || "unknown";
  }
}

export function trackUsageMetric(
  userId: number | string,
  name?: string,
  analyticsEngine?: AnalyticsEngineDataset,
): void {
  const monitor = Monitoring.getInstance(analyticsEngine);
  const traceId = userId?.toString() || generateId();

  monitor.recordMetric({
    traceId,
    timestamp: Date.now(),
    type: "usage",
    name: name || "user_usage",
    value: 1,
    metadata: {
      userId,
    },
    status: "success",
  });
}

export function trackProviderMetrics<T>({
  provider,
  model,
  operation,
  analyticsEngine,
  settings,
  userId,
  completion_id,
}: {
  provider: string;
  model: string;
  operation: () => Promise<T>;
  analyticsEngine?: AnalyticsEngineDataset;
  settings?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    top_k?: number;
    seed?: number;
    repetition_penalty?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  userId?: number;
  completion_id?: string;
}): Promise<T> {
  const startTime = performance.now();
  const monitor = Monitoring.getInstance(analyticsEngine);
  const traceId = completion_id || generateId();

  return operation()
    .then((result: any) => {
      const metrics = {
        userId: userId?.toString(),
        provider,
        model,
        latency: performance.now() - startTime,
        tokenUsage: result?.usage,
        systemFingerprint: result?.system_fingerprint,
        log_id: result?.log_id,
        settings: {
          temperature: settings?.temperature,
          max_tokens: settings?.max_tokens,
          top_p: settings?.top_p,
          top_k: settings?.top_k,
          seed: settings?.seed,
          repetition_penalty: settings?.repetition_penalty,
          frequency_penalty: settings?.frequency_penalty,
          presence_penalty: settings?.presence_penalty,
        },
      };

      monitor.recordMetric({
        traceId,
        timestamp: Date.now(),
        type: "performance",
        name: "ai_provider_response",
        value: metrics.latency,
        metadata: metrics,
        status: "success",
      });

      return result;
    })
    .catch((error) => {
      monitor.recordMetric({
        traceId,
        timestamp: Date.now(),
        type: "error",
        name: "ai_provider_response",
        value: performance.now() - startTime,
        metadata: {
          provider,
          model,
          settings,
          error: error instanceof Error ? error.message : String(error),
        },
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    });
}

export function trackGuardrailViolation(
  violationName: string,
  details: Record<string, any>,
  analyticsEngine?: AnalyticsEngineDataset,
  userId?: number,
  completion_id?: string,
): void {
  const monitor = Monitoring.getInstance(analyticsEngine);
  const traceId = completion_id || generateId();

  monitor.recordMetric({
    traceId,
    timestamp: Date.now(),
    type: "guardrail",
    name: "guardrail_violation",
    value: 0,
    metadata: { violationName, details, userId },
    status: "info",
  });
}

export function trackRagMetrics(
  operation: () => Promise<any>,
  analyticsEngine?: AnalyticsEngineDataset,
  details?: Record<string, any>,
  userId?: number,
  completion_id?: string,
): Promise<any> {
  const startTime = performance.now();
  const monitor = Monitoring.getInstance(analyticsEngine);
  const traceId = completion_id || generateId();

  return operation()
    .then((result) => {
      const latency = performance.now() - startTime;
      monitor.recordMetric({
        traceId,
        timestamp: Date.now(),
        type: "performance",
        name: "rag",
        value: latency,
        metadata: { result, details, userId },
        status: "success",
      });
      return result;
    })
    .catch((error: any) => {
      const latency = performance.now() - startTime;
      monitor.recordMetric({
        traceId,
        timestamp: Date.now(),
        type: "error",
        name: "rag",
        value: latency,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    });
}

export function trackModelRoutingMetrics<T>(
  operation: () => Promise<T>,
  analyticsEngine?: AnalyticsEngineDataset,
  details?: Record<string, any>,
  userId?: number,
  completion_id?: string,
): Promise<T> {
  const startTime = performance.now();
  const monitor = Monitoring.getInstance(analyticsEngine);
  const traceId = completion_id || generateId();

  return operation()
    .then((result) => {
      const latency = performance.now() - startTime;
      monitor.recordMetric({
        traceId,
        timestamp: Date.now(),
        type: "performance",
        name: "model_routing",
        value: latency,
        metadata: { details, result, userId },
        status: "success",
      });
      return result;
    })
    .catch((error: any) => {
      const latency = performance.now() - startTime;
      monitor.recordMetric({
        traceId,
        timestamp: Date.now(),
        type: "error",
        name: "model_routing",
        value: latency,
        metadata: {
          details,
          error: error instanceof Error ? error.message : String(error),
        },
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    });
}

// Enhanced tracking functions
export async function trackQueryPerformance(
  query: string,
  duration: number,
  success: boolean,
  analyticsEngine?: AnalyticsEngineDataset,
  userId?: string,
): Promise<void> {
  if (!analyticsEngine) return;
  
  try {
    const monitoring = Monitoring.getInstance(analyticsEngine);
    await monitoring.trackQueryPerformance(query, duration, success, userId);
  } catch (error) {
    logger.error("Failed to track query performance", { error });
  }
}

export async function trackEndpointPerformance(
  endpoint: string,
  method: string,
  duration: number,
  statusCode: number,
  analyticsEngine?: AnalyticsEngineDataset,
  userId?: string,
): Promise<void> {
  if (!analyticsEngine) return;
  
  try {
    const monitoring = Monitoring.getInstance(analyticsEngine);
    await monitoring.trackEndpointPerformance(endpoint, method, duration, statusCode, userId);
  } catch (error) {
    logger.error("Failed to track endpoint performance", { error });
  }
}

export async function trackCacheMetrics(
  cacheKey: string,
  hit: boolean,
  duration?: number,
  analyticsEngine?: AnalyticsEngineDataset,
): Promise<void> {
  if (!analyticsEngine) return;
  
  try {
    const monitoring = Monitoring.getInstance(analyticsEngine);
    await monitoring.trackCacheMetrics(cacheKey, hit, duration);
  } catch (error) {
    logger.error("Failed to track cache metrics", { error });
  }
}
