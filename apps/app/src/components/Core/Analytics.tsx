import { useEffect } from "react";

import { BEACON_ALLOWED_ORIGINS, IS_PRODUCTION } from "~/constants";

const BEACON_ENDPOINT = IS_PRODUCTION
	? "https://beacon.polychat.app"
	: "http://localhost:5173";

const getAllowedOrigin = (endpoint: string) => {
	try {
		const origin = new URL(endpoint).origin;
		return BEACON_ALLOWED_ORIGINS.includes(origin) ? origin : "";
	} catch {
		return "";
	}
};

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
			destroy?: () => void;
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
			destroy?: () => void;
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

		const allowedOrigin = getAllowedOrigin(beaconEndpoint);

		if (!allowedOrigin) {
			return;
		}

		let beaconScript: HTMLScriptElement | null = null;
		let beaconPreload: HTMLLinkElement | null = null;
		const beaconSrc = `${allowedOrigin}/beacon.min.js`;

		if (window._beaconInitialized) {
			const existingBeaconScript = document.querySelector(
				`script[src="${beaconSrc}"]`,
			);
			if (!existingBeaconScript) {
				delete window._beaconInitialized;
			} else {
				beaconScript = existingBeaconScript as HTMLScriptElement;
			}
		}

		const cleanup = () => {
			beaconPreload?.remove();
			beaconScript?.remove();
			window.Beacon?.destroy?.();
			delete window._beaconInitialized;
			delete window.Beacon;
		};

		if (beaconScript) {
			return cleanup;
		}

		window._beaconInitialized = true;

		beaconPreload = document.createElement("link");
		beaconPreload.rel = "preload";
		beaconPreload.as = "script";
		beaconPreload.href = beaconSrc;
		document.head.appendChild(beaconPreload);

		beaconScript = document.createElement("script");
		beaconScript.src = beaconSrc;
		beaconScript.async = true;

		beaconScript.onload = () => {
			if (window.Beacon) {
				window.Beacon.init({
					endpoint: allowedOrigin,
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

		beaconScript.onerror = cleanup;

		document.head.appendChild(beaconScript);

		return cleanup;
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
		let expBeaconPreload: HTMLLinkElement | null = null;
		const allowedOrigin = getAllowedOrigin(beaconEndpoint);

		if (!allowedOrigin) {
			return;
		}
		const expBeaconSrc = `${allowedOrigin}/exp-beacon.min.js`;

		if (window._expBeaconInitialized) {
			const existingExpScript = document.querySelector(
				`script[src="${expBeaconSrc}"]`,
			);
			if (!existingExpScript) {
				delete window._expBeaconInitialized;
			} else {
				expBeaconScript = existingExpScript as HTMLScriptElement;
			}
		}

		const cleanup = () => {
			expBeaconPreload?.remove();
			expBeaconScript?.remove();
			window.BeaconExperiments?.destroy?.();
			delete window._expBeaconInitialized;
			delete window.BeaconExperiments;
		};

		if (expBeaconScript) {
			return cleanup;
		}

		window._expBeaconInitialized = true;

		expBeaconPreload = document.createElement("link");
		expBeaconPreload.rel = "preload";
		expBeaconPreload.as = "script";
		expBeaconPreload.href = expBeaconSrc;
		document.head.appendChild(expBeaconPreload);

		expBeaconScript = document.createElement("script");
		expBeaconScript.src = expBeaconSrc;
		expBeaconScript.async = true;

		expBeaconScript.onload = () => {
			if (window.BeaconExperiments) {
				window.BeaconExperiments.init({
					debug: beaconDebug,
					endpoint: allowedOrigin,
				});
			}
		};

		expBeaconScript.onerror = cleanup;

		document.head.appendChild(expBeaconScript);

		return cleanup;
	}, [beaconDebug, beaconEndpoint, isExperimentsEnabled]);

	return null;
}
