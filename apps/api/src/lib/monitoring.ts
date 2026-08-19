import type { AnalyticsEngineDataset, ExecutionContext } from "@cloudflare/workers-types";

import { createBackendAnalytics } from "~/lib/analytics/core";
import { captureProviderGenerationResult } from "~/lib/analytics/provider-generation";
import type {
  BackendAiGenerationCaptureInput,
  BackendAnalytics,
  BackendAnalyticsEnv,
} from "~/lib/analytics/types";
import { extractUsagePayload } from "~/lib/usage/extractUsage";
import { normaliseTokenUsage, type NormalisedTokenUsage } from "~/lib/usage/tokenUsage";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/monitoring" });

export interface Metric {
  traceId: string;
  timestamp: number;
  type: "performance" | "error" | "usage" | "guardrail";
  name: string;
  value: number;
  metadata: Record<string, unknown>;
  status: "success" | "error" | "info";
  error?: string;
}

export class Monitoring {
  private analytics: BackendAnalytics;

  constructor(env?: BackendAnalyticsEnv, executionCtx?: ExecutionContext) {
    if (!env) {
      throw new AssistantError("Analytics Engine not configured", ErrorType.CONFIGURATION_ERROR);
    }

    this.analytics = createBackendAnalytics({ env, executionCtx });
  }

  public static getInstance(
    env?: BackendAnalyticsEnv,
    executionCtx?: ExecutionContext,
  ): Monitoring {
    return new Monitoring(env, executionCtx);
  }

  public recordMetric(metric: Metric): void {
    logger.debug("Recording metric", { metric });
    const metricWithTraceId = {
      ...metric,
      traceId: metric.traceId || generateId(),
    };

    if (!this.validateMetric(metricWithTraceId)) {
      logger.warn("Invalid metric structure:", { metric: metricWithTraceId });

      return;
    }

    if (this.analytics.providers.length === 0) {
      logger.debug(
        `[Metric] ${metricWithTraceId.type}:${metricWithTraceId.name}`,
        JSON.stringify(
          {
            value: metricWithTraceId.value,
            status: metricWithTraceId.status,
            metadata: metricWithTraceId.metadata,
            error: metricWithTraceId.error || "",
          },
          null,
          2,
        ),
      );

      return;
    }

    this.analytics.recordMetric(metricWithTraceId);

    logger.debug("Metric recorded successfully", { metric: metricWithTraceId });
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

function trackAiGeneration(
  input: BackendAiGenerationCaptureInput & {
    env: BackendAnalyticsEnv;
    executionCtx?: ExecutionContext;
  },
): void {
  try {
    const analytics = createBackendAnalytics({
      env: input.env,
      executionCtx: input.executionCtx,
    });

    if (analytics.providers.length === 0) {
      return;
    }

    analytics.captureAiGeneration(input);
  } catch (error) {
    logger.warn("Failed to capture AI generation analytics", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function trackUsageMetric(
  userId: number | string,
  name?: string,
  analyticsEngine?: AnalyticsEngineDataset,
): void {
  const monitor = Monitoring.getInstance({ ANALYTICS: analyticsEngine });
  const traceId = userId?.toString() || generateId();

  try {
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
  } catch (error) {
    logger.error("Failed to track usage metric", {
      error,
      userId,
      name,
    });
  }
}

export function trackProviderMetrics<T>({
  provider,
  model,
  operation,
  analyticsEngine,
  settings,
  userId,
  completion_id,
  request,
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
  request?: ChatCompletionParameters;
}): Promise<T> {
  const startTime = performance.now();
  const monitor = Monitoring.getInstance(
    request?.env ?? { ANALYTICS: analyticsEngine },
    request?.executionCtx,
  );
  const traceId = completion_id || generateId();

  return operation()
    .then((result: any) => {
      const latency = performance.now() - startTime;
      const metrics = {
        userId: userId?.toString(),
        provider,
        model,
        latency,
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

      if (!(result instanceof ReadableStream)) {
        trackTokenUsage({
          usage: extractUsagePayload(result),
          provider,
          model,
          env: request?.env ?? { ANALYTICS: analyticsEngine },
          executionCtx: request?.executionCtx,
          userId,
          completion_id: traceId,
          streamed: false,
        });
      }

      return captureProviderGenerationResult(
        result,
        { provider, model, traceId, request, startTime },
        trackAiGeneration,
        (error) => logger.debug("Failed to parse provider stream analytics event", { error }),
      );
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

export function trackTokenUsage({
  usage,
  provider,
  model,
  env,
  executionCtx,
  userId,
  completion_id,
  streamed,
  expectUsage = false,
}: {
  usage: unknown;
  provider?: string;
  model?: string;
  env?: BackendAnalyticsEnv;
  executionCtx?: ExecutionContext;
  userId?: number;
  completion_id?: string;
  streamed: boolean;
  expectUsage?: boolean;
}): NormalisedTokenUsage | null {
  const normalised = normaliseTokenUsage(usage);
  const traceId = completion_id || generateId();
  const metadata = {
    provider: provider || "unknown",
    model: model || "unknown",
    userId: userId?.toString(),
    streamed,
    reported: normalised !== null,
    input_tokens: normalised?.input_tokens ?? 0,
    output_tokens: normalised?.output_tokens ?? 0,
    total_tokens: normalised?.total_tokens ?? 0,
    cached_input_tokens: normalised?.cached_input_tokens ?? 0,
    cache_creation_tokens: normalised?.cache_creation_tokens ?? 0,
    reasoning_tokens: normalised?.reasoning_tokens ?? 0,
  };

  if (!normalised && expectUsage) {
    logger.warn("Provider returned no token usage", {
      provider: metadata.provider,
      model: metadata.model,
      streamed,
      completion_id,
    });
  }

  try {
    Monitoring.getInstance(env, executionCtx).recordMetric({
      traceId,
      timestamp: Date.now(),
      type: "usage",
      name: "ai_token_usage",
      value: normalised?.total_tokens ?? 0,
      metadata,
      status: normalised ? "success" : "info",
    });
  } catch (error) {
    logger.debug("Failed to record token usage metric", { error });
  }

  return normalised;
}

export function trackGuardrailViolation(
  violationName: string,
  details: Record<string, any>,
  analyticsEngine?: AnalyticsEngineDataset,
  userId?: number,
  completion_id?: string,
): void {
  const monitor = Monitoring.getInstance({ ANALYTICS: analyticsEngine });
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
  const monitor = Monitoring.getInstance({ ANALYTICS: analyticsEngine });
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
  const monitor = Monitoring.getInstance({ ANALYTICS: analyticsEngine });
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
