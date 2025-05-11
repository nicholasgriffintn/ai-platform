import { useEffect } from "react";

declare global {
  interface Window {
    Beacon?: {
      trackEvent: (event: {
        name: string;
        category: string;
        label?: string;
        value?: number | string;
        nonInteraction?: boolean;
        properties?: Record<string, string>;
      }) => void;
      trackPageView: (pageView: {
        contentType?: string;
        virtualPageview?: boolean;
        properties?: Record<string, string>;
      }) => void;
      init: (config: {
        endpoint: string;
        siteId: string;
        debug: boolean;
        trackClicks: boolean;
        trackUserTimings: boolean;
      }) => void;
    };
    _beaconInitialized?: boolean;
  }
}

export function Analytics({
  isEnabled = true,
  beaconEndpoint = "https://beacon.polychat.app",
  beaconSiteId = "test-beacon",
  beaconDebug = false,
}: {
  isEnabled?: boolean;
  beaconEndpoint?: string;
  beaconSiteId?: string;
  beaconDebug?: boolean;
}) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only react to enabled state
  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    if (
      window._beaconInitialized ||
      document.querySelector(
        'script[src="https://beacon.polychat.app/beacon.min.js"]',
      )
    ) {
      return;
    }

    window._beaconInitialized = true;

    const script = document.createElement("script");
    script.src = "https://beacon.polychat.app/beacon.min.js";
    script.async = true;

    script.onload = () => {
      if (window.Beacon) {
        window.Beacon.init({
          endpoint: beaconEndpoint,
          siteId: beaconSiteId,
          debug: beaconDebug,
          trackClicks: true,
          trackUserTimings: true,
        });
      }
    };

    document.head.appendChild(script);

    return () => {};
  }, [isEnabled]);

  return null;
}
