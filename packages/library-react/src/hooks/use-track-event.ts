import {
  ANALYTICS_EVENT_CATEGORIES,
  type AnalyticsEventProperties,
} from "@ngriffin_uk/polychat-schemas/analytics";
import { useCallback } from "react";

import { captureClientException, trackClientEvent } from "../lib/analytics/client.js";

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
  const trackEvent = useCallback((event: TrackEventProps) => {
    trackClientEvent({
      name: event.name,
      category: event.category,
      label: event.label,
      value: event.value,
      nonInteraction: event.non_interaction,
      properties: event.properties,
    });
  }, []);

  const trackException = useCallback(
    (error: Error | string, properties?: AnalyticsEventProperties) => {
      captureClientException(error, properties);
    },
    [],
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
