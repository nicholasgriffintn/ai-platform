import { createProviderMetrics, resolveAiGatewayId } from "@ngriffin_uk/polychat-ai-providers";
import {
  createWorkerMetricsRecorder,
  createWorkerTelemetry,
  type MetricsRecorder,
  type Telemetry,
  type TelemetryEnv,
  type TelemetryIdentityInput,
  type TelemetryExecutionContext,
} from "@ngriffin_uk/polychat-ai-telemetry";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

export function createTelemetry(
  env: TelemetryEnv,
  executionCtx?: TelemetryExecutionContext,
): Telemetry {
  return createWorkerTelemetry({
    env,
    executionCtx,
    resolveAiGatewayId,
  });
}

export function createMetrics(
  env: TelemetryEnv,
  executionCtx?: TelemetryExecutionContext,
): MetricsRecorder {
  return createWorkerMetricsRecorder({
    env,
    executionCtx,
    resolveAiGatewayId,
  });
}

export function resolveTelemetryIdentity(
  context?: Pick<ServiceContext, "user" | "anonymousUser"> | null,
): TelemetryIdentityInput {
  return {
    userId: context?.user?.id,
    anonymousUserId: context?.anonymousUser?.id,
    email: context?.user?.email,
    planId: context?.user?.plan_id,
  };
}

export const providerMetrics = createProviderMetrics({
  telemetryFor: ({ env, executionCtx }) => createTelemetry(env ?? {}, executionCtx),
});
