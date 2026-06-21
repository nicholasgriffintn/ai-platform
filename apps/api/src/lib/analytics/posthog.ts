import type { ExecutionContext } from "@cloudflare/workers-types";
import { PostHog } from "posthog-node";

import { omitNullishValues } from "~/utils/objects";

import { getPostHogAnalyticsConfig } from "./config";
import type { AnalyticsProvider, BackendAnalyticsEnv, BackendAnalyticsOptions } from "./types";

export function createPostHogProvider(
	env: BackendAnalyticsEnv,
	createPostHogClient: BackendAnalyticsOptions["createPostHogClient"] = createDefaultPostHogClient,
	executionCtx?: ExecutionContext,
): AnalyticsProvider | null {
	const config = getPostHogAnalyticsConfig(env);
	if (!config || !createPostHogClient) {
		return null;
	}

	const client = createPostHogClient(config.apiKey, {
		host: config.host,
	});

	return {
		name: "posthog",
		capture(event) {
			client.capture({
				distinctId: event.distinctId,
				event: event.name,
				properties: omitNullishValues({
					category: event.category,
					...event.properties,
					...(event.label !== undefined ? { label: event.label } : {}),
					...(event.value !== undefined ? { value: event.value } : {}),
					...(event.nonInteraction !== undefined ? { non_interaction: event.nonInteraction } : {}),
				}),
			});
			schedulePostHogFlush(client, executionCtx);
		},
	};
}

function schedulePostHogFlush(client: PostHog, executionCtx?: ExecutionContext): void {
	const flushPromise = client.flush();
	const guardedFlush = flushPromise.catch((err) => {
		console.error("[PostHog] flush failed:", err);
	});
	if (executionCtx) {
		executionCtx.waitUntil(guardedFlush);
		return;
	}

	void guardedFlush;
}

function createDefaultPostHogClient(
	apiKey: string,
	options: ConstructorParameters<typeof PostHog>[1],
): PostHog {
	return new PostHog(apiKey, options);
}
