import { useCallback, useEffect, useState } from "react";

const OPENFEATURE_POLL_INTERVAL_MS = 100;
const OPENFEATURE_READY_TIMEOUT_MS = 5000;

function getOpenFeatureClient(): Window["BeaconOpenFeature"] {
	if (typeof window === "undefined") {
		return undefined;
	}

	return window.BeaconOpenFeature;
}

export function useOpenFeature() {
	const [isReady, setIsReady] = useState(false);

	useEffect(() => {
		const checkOpenFeature = () => {
			if (getOpenFeatureClient()) {
				setIsReady(true);
				return true;
			}
			return false;
		};

		if (!checkOpenFeature()) {
			const interval = setInterval(() => {
				if (checkOpenFeature()) {
					clearInterval(interval);
				}
			}, OPENFEATURE_POLL_INTERVAL_MS);

			return () => clearInterval(interval);
		}
	}, []);

	const waitForOpenFeature = useCallback(async () => {
		const existingClient = getOpenFeatureClient();
		if (isReady || existingClient) {
			return existingClient;
		}

		return new Promise<Window["BeaconOpenFeature"]>((resolve) => {
			const startedAt = Date.now();
			const check = () => {
				const client = getOpenFeatureClient();
				if (client || Date.now() - startedAt >= OPENFEATURE_READY_TIMEOUT_MS) {
					resolve(client);
					return;
				}

				setTimeout(check, OPENFEATURE_POLL_INTERVAL_MS);
			};
			check();
		});
	}, [isReady]);

	const getObjectDetails = useCallback(
		async <TValue extends Record<string, unknown>>(
			flagKey: string,
			defaultValue: TValue,
			context?: Record<string, unknown>,
		) => {
			const client = await waitForOpenFeature();
			return client?.getObjectDetails(flagKey, defaultValue, context);
		},
		[waitForOpenFeature],
	);

	const track = useCallback(
		async (
			trackingEventName: string,
			context?: Record<string, unknown>,
			details?: Record<string, unknown>,
		) => {
			const client = await waitForOpenFeature();
			return client?.track(trackingEventName, context, details);
		},
		[waitForOpenFeature],
	);

	return {
		getObjectDetails,
		track,
		isReady,
	};
}
