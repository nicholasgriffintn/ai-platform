import { usePostHog } from "posthog-js/react";
import { useCallback } from "react";
import { useAuthStatus } from "~/hooks/useAuth";

export const EventCategory = {
	AUTH: "authentication",
	CONVERSATION: "conversation",
	UI_INTERACTION: "ui_interaction",
	FEATURE_USAGE: "feature_usage",
	ERROR: "error",
	USER_JOURNEY: "user_journey",
	NAVIGATION: "navigation",
	SESSION: "session",
};

export type TrackEventProps = {
	name: string;
	category: string;
	label?: string;
	value?: number | string;
	non_interaction?: boolean;
	properties?: Record<string, string | boolean | number | null | undefined>;
};

export function useTrackEvent() {
	const { isAuthenticated, user } = useAuthStatus();
	const posthog = usePostHog();

	const trackEvent = useCallback(
		(event: TrackEventProps) => {
			const enhancedProperties: Record<string, string> = {};

			if (event.properties) {
				for (const [key, value] of Object.entries(event.properties)) {
					if (value !== null && value !== undefined) {
						enhancedProperties[key] = String(value);
					}
				}
			}

			enhancedProperties.authenticated = String(isAuthenticated);
			if (isAuthenticated && user && user.id) {
				enhancedProperties.user_id = String(user.id);
			}

			if (typeof window !== "undefined" && window.Beacon) {
				window.Beacon.trackEvent({
					...event,
					properties: enhancedProperties,
				});
			}

			if (posthog) {
				const posthogProps: Record<string, any> = {
					category: event.category,
					...enhancedProperties,
				};
				if (event.label !== undefined) {
					posthogProps.label = event.label;
				}
				if (event.value !== undefined) {
					posthogProps.value = event.value;
				}
				if (event.non_interaction !== undefined) {
					posthogProps.non_interaction = event.non_interaction;
				}
				posthog.capture(event.name, posthogProps);
			}
		},
		[isAuthenticated, user, posthog],
	);

	const trackException = useCallback(
		(error: Error | string, properties?: Record<string, any>) => {
			if (posthog) {
				const enhancedProperties = {
					authenticated: String(isAuthenticated),
					...(isAuthenticated && user?.id && { user_id: String(user.id) }),
					...properties,
				};

				posthog.captureException(error, enhancedProperties);
			}

			trackEvent({
				name: "exception",
				category: EventCategory.ERROR,
				properties: {
					error_message: error instanceof Error ? error.message : String(error),
					error_stack: error instanceof Error ? error.stack : undefined,
					...properties,
				},
			});
		},
		[posthog, isAuthenticated, user, trackEvent],
	);

	const trackAuth = useCallback(
		(
			name: string,
			properties?: Record<string, string | boolean | number | null | undefined>,
		) => {
			trackEvent({
				name,
				category: EventCategory.AUTH,
				properties,
			});
		},
		[trackEvent],
	);

	const trackError = useCallback(
		(
			name: string,
			error: unknown,
			properties?: Record<string, string | boolean | number | null | undefined>,
		) => {
			trackEvent({
				name,
				category: EventCategory.ERROR,
				properties: {
					...properties,
					error_message: error instanceof Error ? error.message : String(error),
				},
			});
		},
		[trackEvent],
	);

	const trackFeatureUsage = useCallback(
		(
			name: string,
			properties?: Record<string, string | boolean | number | null | undefined>,
		) => {
			trackEvent({
				name,
				category: EventCategory.FEATURE_USAGE,
				properties,
			});
		},
		[trackEvent],
	);

	const trackNavigation = useCallback(
		(
			path: string,
			properties?: Record<string, string | boolean | number | null | undefined>,
		) => {
			trackEvent({
				name: "page_view",
				category: EventCategory.NAVIGATION,
				properties: {
					...properties,
					path,
				},
			});
		},
		[trackEvent],
	);

	return {
		trackEvent,
		trackException,
		trackAuth,
		trackError,
		trackFeatureUsage,
		trackNavigation,
		EventCategory,
	};
}
