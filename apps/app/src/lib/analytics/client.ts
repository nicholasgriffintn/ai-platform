import {
	buildAnalyticsDistinctId,
	compactAnalyticsProperties,
	stringifyAnalyticsProperties,
	type AnalyticsEvent as SharedAnalyticsEvent,
	type AnalyticsEventProperties,
} from "@assistant/schemas";

import type { User } from "~/types";

export type { AnalyticsEventProperties };

export type AnalyticsEvent = SharedAnalyticsEvent & {
	non_interaction?: boolean;
};

export type ClientPostHog = {
	capture: (eventName: string, properties?: Record<string, string | number | boolean>) => void;
	captureException?: (
		error: Error | string,
		properties?: Record<string, string | number | boolean>,
	) => void;
	identify?: (distinctId: string, properties?: Record<string, string>) => void;
	reset?: () => void;
};

export type ClientBeacon = {
	trackEvent: (event: {
		name: string;
		category: string;
		label?: string;
		value?: number | string;
		non_interaction?: boolean;
		properties?: Record<string, string>;
	}) => void;
	setUserId?: (userId: string) => boolean;
};

export type ClientAnalyticsProviders = {
	posthog?: ClientPostHog | null;
	beacon?: ClientBeacon | null;
};

export function trackClientEvent(
	event: AnalyticsEvent,
	{ posthog, beacon }: ClientAnalyticsProviders,
): void {
	const beaconProperties = stringifyAnalyticsProperties(event.properties);
	const posthogProperties = compactAnalyticsProperties(event.properties);
	const nonInteraction = event.nonInteraction ?? event.non_interaction;

	if (beacon) {
		beacon.trackEvent({
			...event,
			non_interaction: nonInteraction,
			properties: beaconProperties,
		});
	}

	if (posthog) {
		posthog.capture(event.name, {
			category: event.category,
			...posthogProperties,
			...(event.label !== undefined ? { label: event.label } : {}),
			...(event.value !== undefined ? { value: event.value } : {}),
			...(nonInteraction !== undefined ? { non_interaction: nonInteraction } : {}),
		});
	}
}

export function captureClientException(
	error: Error | string,
	properties: AnalyticsEventProperties | undefined,
	providers: ClientAnalyticsProviders,
): void {
	const exceptionProperties = stringifyAnalyticsProperties(properties);
	if (exceptionProperties.category) {
		exceptionProperties.category_detail = exceptionProperties.category;
		delete exceptionProperties.category;
	}

	providers.posthog?.captureException?.(error, exceptionProperties);

	trackClientEvent(
		{
			name: "exception",
			category: "error",
			properties: {
				error_message: error instanceof Error ? error.message : String(error),
				...exceptionProperties,
			},
		},
		providers,
	);
}

export function syncAnalyticsIdentity({
	isAuthenticated,
	user,
	posthog,
	beacon,
}: {
	isAuthenticated: boolean;
	user?: Pick<User, "id" | "email" | "plan_id"> | null;
	posthog?: Pick<ClientPostHog, "identify" | "reset"> | null;
	beacon?: Pick<ClientBeacon, "setUserId"> | null;
}): void {
	if (!isAuthenticated || !user?.id) {
		posthog?.reset?.();
		return;
	}

	const distinctId = buildClientDistinctId(user.id);
	const properties = stringifyAnalyticsProperties({
		user_id: user.id,
		email: user.email,
		plan_id: user.plan_id,
	});

	posthog?.identify?.(distinctId, properties);
	beacon?.setUserId?.(distinctId);
}

export function buildClientDistinctId(userId: string | number): string {
	return buildAnalyticsDistinctId({ userId });
}
