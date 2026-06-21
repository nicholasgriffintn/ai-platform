import type { AnalyticsEngineDataset } from "@cloudflare/workers-types";

import type {
	AnalyticsEngineMetric,
	AnalyticsProvider,
	BackendAnalyticsEnv,
	BackendAnalyticsEvent,
} from "./types";

export function createAnalyticsEngineProvider(
	env: BackendAnalyticsEnv,
	now: () => number,
): AnalyticsProvider | null {
	if (!env.ANALYTICS || typeof env.ANALYTICS.writeDataPoint !== "function") {
		return null;
	}

	return {
		name: "analytics_engine",
		capture(event) {
			const properties = event.properties || {};
			const metric = {
				traceId:
					typeof properties.traceId === "string" && properties.traceId
						? properties.traceId
						: event.distinctId,
				timestamp: now(),
				type: event.category,
				name: event.name,
				value: typeof event.value === "number" ? event.value : 1,
				metadata: {
					distinctId: event.distinctId,
					...(event.label !== undefined ? { label: event.label } : {}),
					...(event.nonInteraction !== undefined ? { nonInteraction: event.nonInteraction } : {}),
					...properties,
				},
				status:
					typeof properties.status === "string" && properties.status
						? properties.status
						: "success",
				error:
					typeof properties.error === "string" && properties.error ? properties.error : undefined,
			};

			writeAnalyticsEngineMetric(env.ANALYTICS, metric);
		},
		recordMetric(metric) {
			writeAnalyticsEngineMetric(env.ANALYTICS, metric);
		},
	};
}

export function writeAnalyticsEngineMetric(
	analyticsEngine: AnalyticsEngineDataset,
	metric: AnalyticsEngineMetric,
): void {
	analyticsEngine.writeDataPoint({
		blobs: [
			metric.type,
			metric.name,
			metric.status,
			metric.error || "None",
			metric.traceId,
			JSON.stringify(metric.metadata),
		],
		doubles: [metric.value, metric.timestamp],
		indexes: [metric.traceId],
	});
}

export function analyticsEventFromMetric(metric: AnalyticsEngineMetric): BackendAnalyticsEvent {
	return {
		name: metric.name,
		category: metric.type,
		distinctId: metric.traceId,
		value: metric.value,
		properties: metric.metadata,
	};
}
