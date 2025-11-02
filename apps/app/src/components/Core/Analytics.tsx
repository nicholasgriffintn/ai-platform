import { useEffect } from "react";

import { IS_PRODUCTION } from "~/constants";

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
			version: string;
			config: Record<string, string>;
			init: (config: {
				endpoint: string;
				siteId: string;
				debug: boolean;
				trackClicks: boolean;
				trackUserTimings: boolean;
				respectDoNotTrack: boolean;
				directEvents?: boolean;
				directPageViews?: boolean;
				batchSize?: number;
				batchTimeout?: number;
			}) => void;
			trackEvent: (event: {
				name: string;
				category: string;
				label?: string;
				value?: number | string;
				non_interaction?: boolean;
				properties?: Record<string, string>;
			}) => void;
			trackPageView: (pageView: {
				content_type?: string;
				virtual_pageview?: boolean;
				properties?: Record<string, string>;
			}) => void;
			setConsent: (consent: boolean) => void;
			hasConsent: () => boolean;
		};
		_beaconInitialized?: boolean;
		_expBeaconInitialized?: boolean;
		BeaconExperiments?: {
			init: (config: { endpoint: string; debug: boolean }) => void;
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
	directEvents = false,
	directPageViews = true,
	batchSize = 10,
	batchTimeout = 5000,
}: {
	isEnabled?: boolean;
	beaconEndpoint?: string;
	beaconSiteId?: string;
	beaconDebug?: boolean;
	directEvents?: boolean;
	directPageViews?: boolean;
	batchSize?: number;
	batchTimeout?: number;
}) {
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
					directEvents,
					directPageViews,
					batchSize,
					batchTimeout,
				});
			}
		};

		document.head.appendChild(script);

		return () => {};
	}, [isEnabled]);

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
					endpoint: beaconEndpoint,
				});
			}
		};

		document.head.appendChild(script);

		return () => {};
	}, [isEnabled]);

	return null;
}
