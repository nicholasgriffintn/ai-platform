import { ANALYTICS_EVENT_CATEGORIES } from "@assistant/schemas";
import { usePostHog } from "posthog-js/react";
import { useCallback } from "react";
import {
	captureClientException,
	trackClientEvent,
	type AnalyticsEventProperties,
} from "~/lib/analytics/client";
import { useChatStore } from "~/state/stores/chatStore";

export const EventCategory = ANALYTICS_EVENT_CATEGORIES;

export type TrackEventProps = {
	name: string;
	category: string;
	label?: string;
	value?: number | string;
	non_interaction?: boolean;
	properties?: AnalyticsEventProperties;
};

export function useTrackEvent() {
	const { isAuthenticated, user } = useChatStore();
	const posthog = usePostHog();

	const trackEvent = useCallback(
		(event: TrackEventProps) => {
			const enhancedProperties: AnalyticsEventProperties = {
				...event.properties,
				authenticated: isAuthenticated,
			};
			if (isAuthenticated && user && user.id) {
				enhancedProperties.user_id = String(user.id);
			}

			trackClientEvent(
				{
					...event,
					properties: enhancedProperties,
				},
				{
					posthog,
					beacon: typeof window !== "undefined" ? window.Beacon : undefined,
				},
			);
		},
		[isAuthenticated, user, posthog],
	);

	const trackException = useCallback(
		(error: Error | string, properties?: AnalyticsEventProperties) => {
			captureClientException(
				error,
				{
					authenticated: isAuthenticated,
					...(isAuthenticated && user?.id ? { user_id: String(user.id) } : {}),
					...properties,
				},
				{
					posthog,
					beacon: typeof window !== "undefined" ? window.Beacon : undefined,
				},
			);
		},
		[posthog, isAuthenticated, user],
	);

	const trackAuth = useCallback(
		(name: string, properties?: AnalyticsEventProperties) => {
			trackEvent({
				name,
				category: EventCategory.AUTH,
				properties,
			});
		},
		[trackEvent],
	);

	const trackError = useCallback(
		(name: string, error: unknown, properties?: AnalyticsEventProperties) => {
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
		(name: string, properties?: AnalyticsEventProperties) => {
			trackEvent({
				name,
				category: EventCategory.FEATURE_USAGE,
				properties,
			});
		},
		[trackEvent],
	);

	const trackNavigation = useCallback(
		(path: string, properties?: AnalyticsEventProperties) => {
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
