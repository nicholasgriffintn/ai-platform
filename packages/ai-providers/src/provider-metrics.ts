import type { ExecutionContext } from "@cloudflare/workers-types";
import {
  createMetricsRecorder,
  extractUsagePayload,
  getLogger,
  type MetricsRecorder,
  type Telemetry,
  type TelemetryEnv,
  type TelemetryIdentityInput,
} from "@ngriffin_uk/polychat-ai-telemetry";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";

import type { ProviderEnv } from "./env.js";
import { captureProviderGenerationResult } from "./generation-analytics.js";
import type { ProviderMetrics, ProviderOperationMetrics } from "./host.js";
import type { ChatCompletionParameters } from "./types/index.js";

const logger = getLogger({ prefix: "ai-providers/metrics" });

export interface TelemetryScope {
  env?: ProviderEnv | TelemetryEnv;
  executionCtx?: ExecutionContext;
}

export interface CreateProviderMetricsOptions {
  telemetryFor: (scope: TelemetryScope) => Telemetry;
}

function isChatRequest(value: unknown): value is ChatCompletionParameters {
  return typeof value === "object" && value !== null && "env" in value;
}

function recorderFor(
  options: CreateProviderMetricsOptions,
  scope: TelemetryScope,
): MetricsRecorder {
  return createMetricsRecorder(options.telemetryFor(scope));
}

export function createProviderMetrics(options: CreateProviderMetricsOptions): ProviderMetrics {
  return {
    trackProviderOperation<T>(
      metrics: ProviderOperationMetrics,
      operation: () => Promise<T>,
    ): Promise<T> {
      const request = isChatRequest(metrics.request) ? metrics.request : undefined;
      const recorder = recorderFor(options, {
        env: request?.env ?? metrics.env,
        executionCtx: request?.executionCtx,
      });
      const startTime = performance.now();
      const traceId = metrics.completion_id || generateId();
      const identity = {
        userId: metrics.userId ?? request?.context?.user?.id,
        anonymousUserId: request?.context?.anonymousUser?.id,
        email: request?.context?.user?.email,
        planId: request?.context?.user?.plan_id,
      } satisfies TelemetryIdentityInput;

      return operation()
        .then((result) => {
          const latency = performance.now() - startTime;
          const record = isRecord(result) ? result : undefined;

          recorder.recordMetric({
            traceId,
            type: "performance",
            name: "ai_provider_response",
            value: latency,
            metadata: {
              userId: metrics.userId?.toString(),
              provider: metrics.provider,
              model: metrics.model,
              latency,
              tokenUsage: record?.usage,
              systemFingerprint: record?.system_fingerprint,
              log_id: record?.log_id,
              settings: metrics.settings,
            },
            identity,
            status: "success",
          });

          if (!(result instanceof ReadableStream)) {
            recorder.trackTokenUsage({
              usage: extractUsagePayload(result),
              provider: metrics.provider,
              model: metrics.model,
              userId: identity.userId,
              anonymousUserId: identity.anonymousUserId,
              completion_id: traceId,
              streamed: false,
            });
          }

          return captureProviderGenerationResult(
            result,
            { provider: metrics.provider, model: metrics.model, traceId, request, startTime },
            (signal) => {
              try {
                const telemetry = options.telemetryFor({
                  env: signal.env,
                  executionCtx: signal.executionCtx,
                });

                if (telemetry.sinks.length > 0) {
                  telemetry.captureAiGeneration(signal);
                }
              } catch (error) {
                logger.warn("Failed to capture AI generation analytics", {
                  error: getErrorMessage(error),
                });
              }
            },
            (error) => logger.debug("Failed to parse provider stream analytics event", { error }),
          );
        })
        .catch((error: unknown) => {
          recorder.recordMetric({
            traceId,
            type: "error",
            name: "ai_provider_response",
            value: performance.now() - startTime,
            metadata: {
              provider: metrics.provider,
              model: metrics.model,
              settings: metrics.settings,
              error: getErrorMessage(error),
            },
            identity,
            status: "error",
            error: getErrorMessage(error),
          });
          throw error;
        });
    },
    trackGuardrailViolation(violationName, details, env, userId, completionId) {
      recorderFor(options, { env }).trackGuardrailViolation(
        violationName,
        details,
        { userId },
        completionId,
      );
    },
  };
}
