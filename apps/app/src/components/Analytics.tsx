import { useEffect } from "react";

const IS_PRODUCTION = import.meta.env.PROD;
const BEACON_ENDPOINT = IS_PRODUCTION
  ? "https://beacon.polychat.app"
  : "http://localhost:5173";

type Variant = {
  id: string;
  name?: string;
  activate: (config: Record<string, string>) => void;
};

export type Experiment = {
  id: string;
  name?: string;
  description?: string;
  autoActivate?: boolean;
  variants: Variant[];
};

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
        respectDoNotTrack: boolean;
      }) => void;
    };
    _beaconInitialized?: boolean;
    _expBeaconInitialized?: boolean;
    BeaconExperiments?: {
      init: (config: {
        debug: boolean;
      }) => void;
      defineExperimentBehaviors: (experiments: Experiment[]) => void;
      activate: (experimentId: string) => void;
      getVariant: (experimentId: string) => {
        variant_id: string;
        config: Record<string, string>;
      };
      forceVariant: (experimentId: string, variantId: string) => void;
    };
  }
}

export function Analytics({
  isEnabled = true,
  beaconEndpoint = BEACON_ENDPOINT,
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
      document.querySelector(`script[src="${beaconEndpoint}/beacon.min.js"]`)
    ) {
      return;
    }

    window._beaconInitialized = true;

    const script = document.createElement("script");
    script.src = `${beaconEndpoint}/beacon.min.js`;
    script.async = true;

    script.onload = () => {
      if (window.Beacon) {
        window.Beacon.init({
          endpoint: beaconEndpoint,
          siteId: beaconSiteId,
          debug: beaconDebug,
          trackClicks: true,
          trackUserTimings: true,
          respectDoNotTrack: false,
        });
      }
    };

    document.head.appendChild(script);

    return () => {};
  }, [isEnabled]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Only react to enabled state
  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    if (
      window._expBeaconInitialized ||
      document.querySelector(
        `script[src="${beaconEndpoint}/exp-beacon.min.js"]`,
      )
    ) {
      return;
    }

    window._expBeaconInitialized = true;

    const script = document.createElement("script");
    script.src = `${beaconEndpoint}/exp-beacon.min.js`;
    script.async = true;

    script.onload = () => {
      if (window.BeaconExperiments) {
        window.BeaconExperiments.init({
          debug: beaconDebug,
        });
      }
    };

    document.head.appendChild(script);

    return () => {};
  }, [isEnabled]);

  return null;
}
