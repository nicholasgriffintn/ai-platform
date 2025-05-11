import { useCallback } from "react";

export function useTrackEvent() {
  const trackEvent = useCallback(
    (event: {
      name: string;
      category: string;
      label?: string;
      value?: number | string;
      nonInteraction?: boolean;
      properties?: Record<string, string>;
    }) => {
      if (window.Beacon) {
        window.Beacon.trackEvent(event);
      }
    },
    [],
  );

  return trackEvent;
}
