import type { AnalyticsEngineDataset } from "@cloudflare/workers-types";

import { AssistantError } from "~/utils/errors";
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

  private constructor(analyticsEngine?: AnalyticsEngineDataset) {
    if (!analyticsEngine) {
      throw new AssistantError("Analytics Engine not configured");
    }

    this.analyticsEngine = analyticsEngine;
  }

  public static getInstance(
    analyticsEngine?: AnalyticsEngineDataset,
  ): Monitoring {
    if (!Monitoring.instance) {
      Monitoring.instance = new Monitoring(analyticsEngine);
    }
    return Monitoring.instance;
  }

  public recordMetric(metric: Metric): void {
    if (!this.validateMetric(metric)) {
      logger.warn("Invalid metric structure:", { metric });
      return;
    }

    if (this.analyticsEngine) {
      if (typeof this.analyticsEngine.writeDataPoint === "function") {
        this.analyticsEngine.writeDataPoint({
          blobs: [
            metric.type,
            metric.name,
            metric.status,
            metric.error || "None",
            metric.traceId,
            JSON.stringify(metric.metadata),
          ],
          doubles: [metric.value, metric.timestamp],
          indexes: [metric.traceId],
        });
      } else {
        logger.warn("Analytics engine does not have writeDataPoint method.", {
          engine: this.analyticsEngine,
        });
      }
    } else {
      logger.debug(
        `[Metric] ${metric.type}:${metric.name}`,
        JSON.stringify(
          {
            value: metric.value,
            status: metric.status,
            metadata: metric.metadata,
            error: metric.error || "",
          },
          null,
          2,
        ),
      );
    }
  }

  private validateMetric(metric: Metric): boolean {
    return (
      typeof metric.traceId === "string" &&
      typeof metric.timestamp === "number" &&
      ["performance", "error", "usage", "guardrail"].includes(metric.type) &&
      typeof metric.name === "string" &&
      typeof metric.value === "number"
    );
  }
}

export function trackUsageMetric(
  userId: number | string,
  name?: string,
  analyticsEngine?: AnalyticsEngineDataset,
): void {
  const monitor = Monitoring.getInstance(analyticsEngine);
  const traceId = userId?.toString();

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
  const traceId = completion_id || crypto.randomUUID();

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
  const traceId = completion_id || crypto.randomUUID();

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
  const traceId = completion_id || crypto.randomUUID();

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
  const traceId = completion_id || crypto.randomUUID();

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
