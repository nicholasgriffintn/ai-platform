import type { ExecutionContext } from "@cloudflare/workers-types";

import { BACKEND_ANALYTICS_APP_NAME, BACKEND_ANALYTICS_APP_TYPE } from "~/constants/analytics";
import { getLogger } from "~/utils/logger";

import { getBeaconAnalyticsConfig } from "./config";
import type { AnalyticsProvider, BackendAnalyticsEnv, BeaconFetcher } from "./types";

const logger = getLogger({ prefix: "lib/analytics/beacon" });

export function createBeaconProvider(
	env: BackendAnalyticsEnv,
	fetcher: BeaconFetcher,
	executionCtx: ExecutionContext | undefined,
	now: () => number,
): AnalyticsProvider | null {
	const config = getBeaconAnalyticsConfig(env);
	if (!config) {
		return null;
	}

	return {
		name: "beacon",
		capture(event) {
			const request = fetcher(`${config.endpoint}/api/events/collect`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					s: config.siteId,
					ts: String(now()),
					type: "event",
					app_name: BACKEND_ANALYTICS_APP_NAME,
					app_type: BACKEND_ANALYTICS_APP_TYPE,
					user_id: event.distinctId,
					event_name: event.name,
					event_category: event.category,
					event_label: event.label || "",
					event_value: event.value ?? 0,
					non_interaction: event.nonInteraction ?? false,
					properties: event.properties || {},
				}),
				keepalive: true,
			}).catch((error) => {
				logger.warn("Beacon analytics request failed", {
					error: error instanceof Error ? error.message : String(error),
				});
			});

			executionCtx?.waitUntil(request);
		},
	};
}
