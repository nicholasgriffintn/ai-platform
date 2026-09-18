import type { ExecutionContext } from "@cloudflare/workers-types";
import { createProviderMetrics } from "@ngriffin_uk/polychat-ai-providers";
import {
  createWorkerMetricsRecorder,
  createWorkerTelemetry,
  type MetricsRecorder,
  type Telemetry,
  type TelemetryEnv,
} from "@ngriffin_uk/polychat-ai-telemetry";

export function createTelemetry(env: TelemetryEnv, executionCtx?: ExecutionContext): Telemetry {
  return createWorkerTelemetry({ env, executionCtx });
}

export function createMetrics(env: TelemetryEnv, executionCtx?: ExecutionContext): MetricsRecorder {
  return createWorkerMetricsRecorder({ env, executionCtx });
}

export const providerMetrics = createProviderMetrics({
  telemetryFor: ({ env, executionCtx }) => createTelemetry(env ?? {}, executionCtx),
});
