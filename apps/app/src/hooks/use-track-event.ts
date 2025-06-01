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
} as const;

export type TrackEventProps = {
  name: string;
  category: string;
  label?: string;
  value?: number | string;
  nonInteraction?: boolean;
  properties?: Record<string, string | boolean | number | null | undefined>;
};

export function useTrackEvent() {
  const { isAuthenticated, user } = useAuthStatus();

  const trackEvent = useCallback(
    (event: TrackEventProps) => {
      if (window.Beacon) {
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

        window.Beacon.trackEvent({
          ...event,
          properties: enhancedProperties,
        });
      }
    },
    [isAuthenticated, user],
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
    trackAuth,
    trackError,
    trackFeatureUsage,
    trackNavigation,
    EventCategory,
  };
}
