import { isAnalyticsTrackingEnabled } from "@assistant/schemas";

import { createAnalyticsEngineProvider } from "./analytics-engine";
import { createBeaconProvider } from "./beacon";
import { buildAiGenerationEvent } from "./ai-observability";
import { shouldCaptureAiContent, shouldCaptureAiObservability } from "./config";
import { createPostHogProvider } from "./posthog";
import { buildAnalyticsDistinctId } from "./identity";
import type { AnalyticsProvider, BackendAnalytics, BackendAnalyticsOptions } from "./types";

export function createBackendAnalytics({
	env,
	executionCtx,
	createPostHogClient,
	fetcher = fetch,
	now = Date.now,
}: BackendAnalyticsOptions): BackendAnalytics {
	const providers = [
		createAnalyticsEngineProvider(env, now),
		createPostHogProvider(env, createPostHogClient, executionCtx),
		createBeaconProvider(env, fetcher, executionCtx, now),
	].filter((provider): provider is AnalyticsProvider => !!provider);

	return {
		providers: providers.map((provider) => provider.name),
		capture(event) {
			for (const provider of providers) {
				provider.capture(event);
			}
		},
		recordMetric(metric) {
			for (const provider of providers) {
				if (provider.recordMetric) {
					provider.recordMetric(metric);
					continue;
				}

				provider.capture({
					name: metric.name,
					category: metric.type,
					distinctId: metric.traceId,
					value: metric.value,
					properties: metric.metadata,
				});
			}
		},
		captureAiGeneration(input) {
			if (!shouldCaptureAiObservability(env)) {
				return;
			}

			const canCapturePromptContent = isAnalyticsTrackingEnabled({
				isAuthenticated: !!input.user?.id,
				userTrackingEnabled: input.userTrackingEnabled,
			});

			const distinctId = buildAnalyticsDistinctId({
				user: input.user,
				anonymousUser: input.anonymousUser,
			});

			this.capture(
				buildAiGenerationEvent({
					...input,
					distinctId,
					captureContent: shouldCaptureAiContent(env) && canCapturePromptContent,
				}),
			);
		},
	};
}
