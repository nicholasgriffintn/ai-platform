import { Suspense, lazy } from "react";

import { getBeaconConfig } from "~/constants";

const AnalyticsLazy = lazy(() =>
	import("~/components/Core/Analytics").then((d) => ({
		default: d.Analytics,
	})),
);

const beaconConfig = getBeaconConfig();

export function AnalyticsBootstrap() {
	return (
		<Suspense fallback={null}>
			<AnalyticsLazy
				isEnabled={beaconConfig.enabled}
				isExperimentsEnabled={beaconConfig.experimentsEnabled}
				beaconEndpoint={beaconConfig.endpoint}
				beaconSiteId={beaconConfig.siteId}
				beaconDebug={beaconConfig.debug}
			/>
		</Suspense>
	);
}
