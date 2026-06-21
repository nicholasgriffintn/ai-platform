import { useEffect } from "react";

const IS_PRODUCTION = import.meta.env.PROD;
const BEACON_ENDPOINT = IS_PRODUCTION ? "https://beacon.polychat.app" : "http://localhost:5173";
const BEACON_CDN_ENDPOINT = "https://beacon-cdn.polychat.app";
const SHOULD_TRACK_CLICKS = true;
const SHOULD_TRACK_USER_TIMINGS = true;
const RESPECT_DO_NOT_TRACK = false;

interface AnalyticsProps {
	isEnabled?: boolean;
	isExperimentsEnabled?: boolean;
	beaconEndpoint?: string;
	beaconCdnEndpoint?: string;
	beaconSiteId?: string;
	beaconDebug?: boolean;
	directEvents?: boolean;
	directPageViews?: boolean;
	batchSize?: number;
	batchTimeout?: number;
	beaconUserId?: string;
	openFeatureBootstrap?: OpenFeatureBootstrap;
}

export function Analytics({
	isEnabled = true,
	isExperimentsEnabled = false,
	beaconEndpoint = BEACON_ENDPOINT,
	beaconCdnEndpoint = BEACON_CDN_ENDPOINT,
	beaconSiteId = "test-beacon",
	beaconDebug = false,
	directEvents = false,
	directPageViews = true,
	batchSize = 10,
	batchTimeout = 5000,
	beaconUserId,
	openFeatureBootstrap,
}: AnalyticsProps) {
	// biome-ignore lint/correctness/useExhaustiveDependencies: Only react to enabled state
	useEffect(() => {
		if (!isEnabled) {
			return;
		}

		if (
			window.__BEACON_INITALISED__ ||
			document.querySelector(`script[src="${beaconEndpoint}/beacon.min.js"]`)
		) {
			return;
		}

		window.__BEACON_INITALISED__ = true;

		const script = document.createElement("script");
		script.src = `${beaconEndpoint}/beacon.min.js`;
		script.async = true;

		script.onload = () => {
			if (window.Beacon) {
				window.Beacon.init({
					endpoint: beaconEndpoint,
					cdnEndpoint: beaconCdnEndpoint,
					siteId: beaconSiteId,
					debug: beaconDebug,
					trackClicks: SHOULD_TRACK_CLICKS,
					trackUserTimings: SHOULD_TRACK_USER_TIMINGS,
					respectDoNotTrack: RESPECT_DO_NOT_TRACK,
					directEvents,
					directPageViews,
					batchSize,
					batchTimeout,
					userId: beaconUserId || window.__BEACON_USER_ID__,
				});
			}
		};

		document.head.appendChild(script);

		return () => {};
	}, [isEnabled]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Only react to enabled state
	useEffect(() => {
		if (!isEnabled || !isExperimentsEnabled) {
			return;
		}

		if (
			window.__OPEN_FEATURE_INITALISED__ ||
			document.querySelector(`script[src="${beaconEndpoint}/exp-beacon.min.js"]`)
		) {
			return;
		}

		window.__OPEN_FEATURE_INITALISED__ = true;

		const script = document.createElement("script");
		script.src = `${beaconEndpoint}/exp-beacon.min.js`;
		script.async = true;

		script.onload = () => {
			if (window.BeaconOpenFeature) {
				window.BeaconOpenFeature.init({
					debug: beaconDebug,
					endpoint: beaconEndpoint,
					cdnEndpoint: beaconCdnEndpoint,
					siteId: beaconSiteId,
					bootstrap: openFeatureBootstrap || window.__BEACON_OPENFEATURE_BOOTSTRAP__,
				});
			}
		};

		document.head.appendChild(script);

		return () => {};
	}, [isEnabled, isExperimentsEnabled]);

	return null;
}
