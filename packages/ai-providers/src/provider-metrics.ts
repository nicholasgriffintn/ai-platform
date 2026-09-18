import type { ExecutionContext } from "@cloudflare/workers-types";
import {
  createMetricsRecorder,
  getLogger,
  type MetricsRecorder,
  type Telemetry,
  type TelemetryEnv,
} from "@ngriffin_uk/polychat-ai-telemetry";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";
import { readStringField } from "@ngriffin_uk/polychat-utility-server/record-fields";

import type { ProviderEnv } from "./env.js";
import {
  captureProviderGenerationFailure,
  captureProviderGenerationResult,
  type CaptureAiGeneration,
  type ProviderGenerationContext,
} from "./generation-analytics.js";
import type { ProviderMetrics, ProviderOperationMetrics } from "./host.js";
import type { ChatCompletionParameters } from "./types/index.js";

const logger = getLogger({ prefix: "ai-providers/metrics" });
const CHAT_COMPLETION_SPAN_NAME = "chat_completion";

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
      const completionId = readStringField(request, "completion_id") ?? metrics.completion_id;
      const context: ProviderGenerationContext = {
        provider: metrics.provider,
        model: metrics.model,
        traceId: readStringField(request, "run_id") ?? completionId ?? generateId(),
        spanId: generateId(),
        sessionId: completionId,
        spanName: CHAT_COMPLETION_SPAN_NAME,
        request,
        startTime: performance.now(),
      };
      const captureGeneration: CaptureAiGeneration = (signal) => {
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
      };

      return operation()
        .then((result) =>
          captureProviderGenerationResult(result, context, captureGeneration, (error) =>
            logger.debug("Failed to parse provider stream analytics event", { error }),
          ),
        )
        .catch((error: unknown) => {
          captureProviderGenerationFailure(error, context, captureGeneration);
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
