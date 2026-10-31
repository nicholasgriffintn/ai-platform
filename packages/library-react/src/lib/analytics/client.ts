import { queueAnalyticsEvent } from "@ngriffin_uk/polychat-library-client";
import {
  compactAnalyticsProperties,
  type AnalyticsEvent,
  type AnalyticsEventProperties,
} from "@ngriffin_uk/polychat-schemas/analytics";

export function trackClientEvent(event: AnalyticsEvent): void {
  queueAnalyticsEvent({
    name: event.name,
    category: event.category,
    label: event.label,
    value: event.value,
    nonInteraction: event.nonInteraction,
    properties: compactAnalyticsProperties(event.properties),
  });
}

export function captureClientException(
  error: Error | string,
  properties: AnalyticsEventProperties | undefined,
): void {
  const { category, ...rest } = properties ?? {};

  trackClientEvent({
    name: "exception",
    category: "error",
    properties: {
      error_message: error instanceof Error ? error.message : error,
      ...rest,
      ...(category !== undefined ? { category_detail: category } : {}),
    },
  });
}
