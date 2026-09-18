import { buildTelemetryPersonProperties, resolveAnalyticsDistinctId } from "./identity.js";
import { createTraceId } from "./ids.js";
import { getLogger } from "./logger.js";
import { createWorkerTelemetry } from "./telemetry.js";
import type { Telemetry } from "./telemetry.js";
import type {
  CreateWorkerTelemetryOptions,
  TelemetryIdentityInput,
  TelemetryMetric,
} from "./types.js";
import { normaliseTokenUsage, type NormalisedTokenUsage } from "./usage/token-usage.js";

const logger = getLogger({ prefix: "ai-telemetry/metrics" });

const METRIC_TYPES = new Set(["performance", "error", "usage", "guardrail"]);

export type MetricInput = Omit<TelemetryMetric, "traceId" | "timestamp"> & {
  traceId?: string;
  timestamp?: number;
  identity?: TelemetryIdentityInput;
};

export interface TrackTokenUsageParams {
  usage: unknown;
  provider?: string;
  model?: string;
  userId?: number;
  anonymousUserId?: string;
  completion_id?: string;
  streamed: boolean;
  expectUsage?: boolean;
}

export interface MetricsRecorder {
  readonly telemetry: Telemetry;
  recordMetric(metric: MetricInput): void;
  trackUsageMetric(identity: TelemetryIdentityInput, name?: string): void;
  trackTokenUsage(params: TrackTokenUsageParams): NormalisedTokenUsage | null;
  trackGuardrailViolation(
    violationName: string,
    details: Record<string, unknown>,
    identity: TelemetryIdentityInput,
    completionId?: string,
  ): void;
}

function isValidMetric(metric: TelemetryMetric): boolean {
  return (
    typeof metric.traceId === "string" &&
    typeof metric.timestamp === "number" &&
    METRIC_TYPES.has(metric.type) &&
    typeof metric.name === "string" &&
    typeof metric.value === "number"
  );
}

export function createMetricsRecorder(
  telemetry: Telemetry,
  options: { now?: () => number } = {},
): MetricsRecorder {
  const now = options.now ?? Date.now;

  const recordMetric = (input: MetricInput): void => {
    const { identity, ...rest } = input;
    const metric: TelemetryMetric = {
      ...rest,
      distinctId: rest.distinctId ?? resolveAnalyticsDistinctId(identity),
      personProperties: rest.personProperties ?? buildTelemetryPersonProperties(identity),
      traceId: input.traceId || createTraceId(),
      timestamp: input.timestamp ?? now(),
    };

    if (!isValidMetric(metric)) {
      logger.warn("Invalid metric structure", { metric });

      return;
    }

    if (telemetry.sinks.length === 0) {
      logger.debug(`[Metric] ${metric.type}:${metric.name}`, {
        value: metric.value,
        status: metric.status,
        metadata: metric.metadata,
        error: metric.error,
      });

      return;
    }

    telemetry.recordMetric(metric);
  };

  return {
    telemetry,
    recordMetric,
    trackUsageMetric: (identity, name) => {
      try {
        recordMetric({
          traceId: identity.userId?.toString() ?? identity.anonymousUserId ?? undefined,
          type: "usage",
          name: name || "user_usage",
          value: 1,
          metadata: { userId: identity.userId, anonymousUserId: identity.anonymousUserId },
          identity,
          status: "success",
        });
      } catch (error) {
        logger.error("Failed to track usage metric", { error, identity, name });
      }
    },
    trackTokenUsage: ({
      usage,
      provider,
      model,
      userId,
      anonymousUserId,
      completion_id,
      streamed,
      expectUsage,
    }) => {
      const normalised = normaliseTokenUsage(usage);
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
        recordMetric({
          traceId: completion_id,
          type: "usage",
          name: "ai_token_usage",
          value: normalised?.total_tokens ?? 0,
          metadata,
          identity: { userId, anonymousUserId },
          status: normalised ? "success" : "info",
        });
      } catch (error) {
        logger.debug("Failed to record token usage metric", { error });
      }

      return normalised;
    },
    trackGuardrailViolation: (violationName, details, identity, completionId) => {
      recordMetric({
        traceId: completionId,
        type: "guardrail",
        name: "guardrail_violation",
        value: 0,
        metadata: {
          violationName,
          details,
          userId: identity.userId,
          anonymousUserId: identity.anonymousUserId,
        },
        identity,
        status: "info",
      });
    },
  };
}

export function createWorkerMetricsRecorder(
  options: CreateWorkerTelemetryOptions,
): MetricsRecorder {
  return createMetricsRecorder(createWorkerTelemetry(options), { now: options.now });
}
