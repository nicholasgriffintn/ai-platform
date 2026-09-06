import type { ExecutionContext } from "@cloudflare/workers-types";

import type { BackendAnalyticsEnv } from "~/lib/analytics/types";
import { Monitoring, type Metric } from "~/lib/monitoring";
import { getLogger } from "~/utils/logger";

import type { ChatStreamContinuitySnapshot } from "./emitter";

const logger = getLogger({ prefix: "lib/chat/streaming/continuity-telemetry" });
const MAX_DURATION_MS = 24 * 60 * 60 * 1_000;

export type ContinuityPlatform = "web" | "ios" | "api" | "unknown";
export type TurnContinuityOutcome = "completed" | "failed" | "cancelled" | "waiting";

export interface RecordMetricContext {
  env: BackendAnalyticsEnv;
  executionCtx?: ExecutionContext;
  traceId: string;
}

export function normaliseContinuityPlatform(platform?: string | null): ContinuityPlatform {
  switch (platform?.toLowerCase()) {
    case "web":
      return "web";
    case "ios":
    case "mobile":
      return "ios";
    case "api":
      return "api";
    default:
      return "unknown";
  }
}

export function recordTurnContinuityFinished(
  context: RecordMetricContext,
  input: {
    platform?: string | null;
    outcome: TurnContinuityOutcome;
    startedAtMs: number;
    finishedAtMs: number;
    stream: ChatStreamContinuitySnapshot;
    cancellationObserved: boolean;
  },
): void {
  const totalDurationMs = durationBetween(input.startedAtMs, input.finishedAtMs);
  const durationBeforeDetachmentMs = input.stream.detachedAtMs
    ? durationBetween(input.startedAtMs, input.stream.detachedAtMs)
    : totalDurationMs;
  const durationAfterDetachmentMs = input.stream.detachedAtMs
    ? durationBetween(input.stream.detachedAtMs, input.finishedAtMs)
    : 0;

  recordContinuityMetric(context, {
    traceId: context.traceId,
    timestamp: input.finishedAtMs,
    type: "performance",
    name: "turn_continuity_finished",
    value: totalDurationMs,
    metadata: {
      platform: normaliseContinuityPlatform(input.platform),
      connection_state: input.stream.detached ? "detached" : "connected",
      detachment_reason: input.stream.detachmentReason ?? "none",
      outcome: input.outcome,
      cancellation_observed: input.cancellationObserved,
      duration_before_detachment_ms: durationBeforeDetachmentMs,
      duration_after_detachment_ms: durationAfterDetachmentMs,
    },
    status: input.outcome === "failed" ? "error" : "success",
  });
}

export function recordTurnCancellationRequested(
  context: RecordMetricContext,
  platform?: string | null,
): void {
  recordContinuityMetric(context, {
    traceId: context.traceId,
    timestamp: Date.now(),
    type: "performance",
    name: "turn_continuity_cancellation_requested",
    value: 1,
    metadata: {
      platform: normaliseContinuityPlatform(platform),
    },
    status: "success",
  });
}

function durationBetween(startedAtMs: number, finishedAtMs: number): number {
  return clampDuration(finishedAtMs - startedAtMs);
}

function clampDuration(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(MAX_DURATION_MS, Math.round(value)));
}

function recordContinuityMetric(context: RecordMetricContext, metric: Metric): void {
  try {
    Monitoring.getInstance(context.env, context.executionCtx).recordMetric(metric);
  } catch {
    logger.debug("Failed to record turn continuity metric", { name: metric.name });
  }
}
