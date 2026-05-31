import { useEffect } from "react";

const BEACON_ENDPOINT = "https://beacon.polychat.app";
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
}: AnalyticsProps) {
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
				});
			}
		};

		document.head.appendChild(script);

		return () => {};
	}, [
		batchSize,
		batchTimeout,
		beaconCdnEndpoint,
		beaconDebug,
		beaconEndpoint,
		beaconSiteId,
		directEvents,
		directPageViews,
		isEnabled,
	]);

	useEffect(() => {
		if (!isEnabled || !isExperimentsEnabled) {
			return;
		}

		if (
			window._openFeatureInitialized ||
			document.querySelector(`script[src="${beaconEndpoint}/exp-beacon.min.js"]`)
		) {
			return;
		}

		window._openFeatureInitialized = true;

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
				});
			}
		};

		document.head.appendChild(script);

		return () => {};
	}, [
		beaconCdnEndpoint,
		beaconDebug,
		beaconEndpoint,
		beaconSiteId,
		isEnabled,
		isExperimentsEnabled,
	]);

	return null;
}
