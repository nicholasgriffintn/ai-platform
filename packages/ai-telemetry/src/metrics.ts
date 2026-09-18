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

const logger = getLogger({ prefix: "ai-telemetry/metrics" });

const METRIC_TYPES = new Set(["performance", "error", "usage", "guardrail"]);

export type MetricInput = Omit<TelemetryMetric, "traceId" | "timestamp"> & {
  traceId?: string;
  timestamp?: number;
  identity?: TelemetryIdentityInput;
};

export interface MetricsRecorder {
  readonly telemetry: Telemetry;
  recordMetric(metric: MetricInput): void;
  trackUsageMetric(identity: TelemetryIdentityInput, name?: string): void;
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
