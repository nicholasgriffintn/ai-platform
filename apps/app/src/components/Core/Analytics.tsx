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
	isEnabled = false,
	isExperimentsEnabled = false,
	beaconEndpoint = BEACON_ENDPOINT,
	beaconSiteId = "",
	beaconDebug = false,
	directEvents = false,
	directPageViews = true,
	batchSize = 10,
	batchTimeout = 5000,
}: {
	isEnabled?: boolean;
	isExperimentsEnabled?: boolean;
	beaconEndpoint?: string;
	beaconSiteId?: string;
	beaconDebug?: boolean;
	directEvents?: boolean;
	directPageViews?: boolean;
	batchSize?: number;
	batchTimeout?: number;
}) {
	useEffect(() => {
		if (!isEnabled || !beaconSiteId.trim()) {
			return;
		}

		let beaconScript: HTMLScriptElement | null = null;

		if (window._beaconInitialized) {
			const existingBeaconScript = document.querySelector(
				`script[src="${beaconEndpoint}/beacon.min.js"]`,
			);
			if (!existingBeaconScript) {
				delete window._beaconInitialized;
			} else {
				beaconScript = existingBeaconScript as HTMLScriptElement;
				return () => {
					beaconScript?.remove();
					delete window._beaconInitialized;
					delete window.Beacon;
				};
			}
		}

		window._beaconInitialized = true;

		beaconScript = document.createElement("script");
		beaconScript.src = `${beaconEndpoint}/beacon.min.js`;
		beaconScript.async = true;

		beaconScript.onload = () => {
			if (window.Beacon) {
				window.Beacon.init({
					endpoint: beaconEndpoint,
					siteId: beaconSiteId,
					debug: beaconDebug,
					trackClicks: true,
					trackUserTimings: true,
					respectDoNotTrack: true,
					directEvents,
					directPageViews,
					batchSize,
					batchTimeout,
				});
			}
		};

		document.head.appendChild(beaconScript);

		return () => {
			beaconScript?.remove();
			delete window._beaconInitialized;
			delete window.Beacon;
		};
	}, [
		batchSize,
		batchTimeout,
		beaconDebug,
		beaconEndpoint,
		beaconSiteId,
		directEvents,
		directPageViews,
		isEnabled,
	]);

	useEffect(() => {
		if (!isExperimentsEnabled) {
			return;
		}

		let expBeaconScript: HTMLScriptElement | null = null;

		if (window._expBeaconInitialized) {
			const existingExpScript = document.querySelector(
				`script[src="${beaconEndpoint}/exp-beacon.min.js"]`,
			);
			if (!existingExpScript) {
				delete window._expBeaconInitialized;
			} else {
				expBeaconScript = existingExpScript as HTMLScriptElement;
				return () => {
					expBeaconScript?.remove();
					delete window._expBeaconInitialized;
					delete window.BeaconExperiments;
				};
			}
		}

		window._expBeaconInitialized = true;

		expBeaconScript = document.createElement("script");
		expBeaconScript.src = `${beaconEndpoint}/exp-beacon.min.js`;
		expBeaconScript.async = true;

		expBeaconScript.onload = () => {
			if (window.BeaconExperiments) {
				window.BeaconExperiments.init({
					debug: beaconDebug,
					endpoint: beaconEndpoint,
				});
			}
		};

		document.head.appendChild(expBeaconScript);

		return () => {
			expBeaconScript?.remove();
			delete window._expBeaconInitialized;
			delete window.BeaconExperiments;
		};
	}, [beaconDebug, beaconEndpoint, isExperimentsEnabled]);

	return null;
}
