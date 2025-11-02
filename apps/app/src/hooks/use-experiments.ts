import { useCallback, useEffect, useState } from "react";

import type { Experiment } from "../components/Core/Analytics";

export function useExperiments() {
	const [isReady, setIsReady] = useState(false);

	useEffect(() => {
		const checkBeaconExperiments = () => {
			if (typeof window !== "undefined" && window.BeaconExperiments) {
				setIsReady(true);
				return true;
			}
			return false;
		};

		if (!checkBeaconExperiments()) {
			const interval = setInterval(() => {
				if (checkBeaconExperiments()) {
					clearInterval(interval);
				}
			}, 100);

			return () => clearInterval(interval);
		}
	}, []);

	const waitForBeaconExperiments = useCallback(async () => {
		if (isReady) return;

		return new Promise<void>((resolve) => {
			const check = () => {
				if (typeof window !== "undefined" && window.BeaconExperiments) {
					resolve();
				} else {
					setTimeout(check, 100);
				}
			};
			check();
		});
	}, [isReady]);

	const defineExperimentBehaviors = useCallback(
		async (experiments: Experiment[]) => {
			await waitForBeaconExperiments();
			if (window.BeaconExperiments) {
				window.BeaconExperiments.defineExperimentBehaviors(experiments);
			}
		},
		[waitForBeaconExperiments],
	);

	const activate = useCallback(
		async (experimentId: string) => {
			await waitForBeaconExperiments();
			if (window.BeaconExperiments) {
				window.BeaconExperiments.activate(experimentId);
			}
		},
		[waitForBeaconExperiments],
	);

	const getVariant = useCallback(
		async (experimentId: string) => {
			await waitForBeaconExperiments();
			if (window.BeaconExperiments) {
				return window.BeaconExperiments.getVariant(experimentId);
			}
		},
		[waitForBeaconExperiments],
	);

	const forceVariant = useCallback(
		async (experimentId: string, variantId: string) => {
			await waitForBeaconExperiments();
			if (window.BeaconExperiments) {
				window.BeaconExperiments.forceVariant(experimentId, variantId);
			}
		},
		[waitForBeaconExperiments],
	);

	return {
		defineExperimentBehaviors,
		activate,
		getVariant,
		forceVariant,
		isReady,
	};
}
