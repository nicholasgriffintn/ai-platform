import { BEACON_DEFAULT_ENDPOINT, POSTHOG_DEFAULT_HOST } from "~/constants/analytics";
import { readBooleanEnv, readEnvString } from "~/utils/env";
import { normaliseHttpOrigin } from "~/utils/urls";

import type { BackendAnalyticsEnv } from "./types";

export type PostHogAnalyticsConfig = {
	apiKey: string;
	host: string;
};

export type BeaconAnalyticsConfig = {
	endpoint: string;
	siteId: string;
};

export function getPostHogAnalyticsConfig(env: BackendAnalyticsEnv): PostHogAnalyticsConfig | null {
	if (!readBooleanEnv(env.POSTHOG_BACKEND_ENABLED, true)) {
		return null;
	}

	const apiKey = readEnvString(env.POSTHOG_PROJECT_API_KEY);
	const host = normaliseHttpOrigin(env.POSTHOG_HOST || POSTHOG_DEFAULT_HOST);
	if (!apiKey || !host) {
		return null;
	}

	return { apiKey, host };
}

export function getBeaconAnalyticsConfig(env: BackendAnalyticsEnv): BeaconAnalyticsConfig | null {
	if (!readBooleanEnv(env.BEACON_BACKEND_ENABLED, false)) {
		return null;
	}

	const endpoint = normaliseHttpOrigin(env.BEACON_ENDPOINT || BEACON_DEFAULT_ENDPOINT);
	const siteId = readEnvString(env.BEACON_SITE_ID);
	if (!endpoint || !siteId) {
		return null;
	}

	return { endpoint, siteId };
}

export function shouldCaptureAiObservability(env: BackendAnalyticsEnv): boolean {
	if (!readBooleanEnv(env.AI_OBSERVABILITY_ENABLED, true)) {
		return false;
	}

	const posthogEnabled =
		readBooleanEnv(env.POSTHOG_AI_OBSERVABILITY_ENABLED, true) && !!getPostHogAnalyticsConfig(env);

	return (
		posthogEnabled ||
		!!getBeaconAnalyticsConfig(env) ||
		(!!env.ANALYTICS && typeof env.ANALYTICS.writeDataPoint === "function")
	);
}

export function shouldCaptureAiContent(env: BackendAnalyticsEnv): boolean {
	return readBooleanEnv(env.POSTHOG_CAPTURE_AI_CONTENT, false);
}
