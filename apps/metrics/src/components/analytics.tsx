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

export function Analytics() {
	useEffect(() => {
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
					endpoint: "https://beacon.polychat.app",
					siteId: "polychat-metrics",
					debug: true,
					trackClicks: true,
					trackUserTimings: true,
				});
			}
		};

		document.head.appendChild(script);

		return () => {};
	}, []);

	return null;
}
