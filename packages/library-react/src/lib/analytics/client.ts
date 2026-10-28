import {
  buildAnalyticsDistinctId,
  stringifyAnalyticsProperties,
  type AnalyticsEvent as SharedAnalyticsEvent,
  type AnalyticsEventProperties,
} from "@ngriffin_uk/polychat-schemas/analytics";
import type { User } from "@ngriffin_uk/polychat-schemas/user-profile";

export type AnalyticsEvent = SharedAnalyticsEvent & {
  non_interaction?: boolean;
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
  beacon?: ClientBeacon | null;
};

export function trackClientEvent(
  event: AnalyticsEvent,
  { beacon }: ClientAnalyticsProviders,
): void {
  const beaconProperties = stringifyAnalyticsProperties(event.properties);
  const nonInteraction = event.nonInteraction ?? event.non_interaction;

  if (beacon) {
    beacon.trackEvent({
      ...event,
      non_interaction: nonInteraction,
      properties: beaconProperties,
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

  trackClientEvent(
    {
      name: "exception",
      category: "error",
      properties: {
        error_message: error instanceof Error ? error.message : error,
        ...exceptionProperties,
      },
    },
    providers,
  );
}

export function syncAnalyticsIdentity({
  isAuthenticated,
  user,
  beacon,
}: {
  isAuthenticated: boolean;
  user?: Pick<User, "id" | "email" | "plan_id"> | null;
  beacon?: Pick<ClientBeacon, "setUserId"> | null;
}): void {
  if (!isAuthenticated || !user?.id) {
    return;
  }

  beacon?.setUserId?.(buildClientDistinctId(user.id));
}

export function buildClientDistinctId(userId: string | number): string {
  return buildAnalyticsDistinctId({ userId });
}
