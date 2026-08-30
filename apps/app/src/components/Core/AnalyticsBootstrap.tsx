import { Analytics } from "~/components/Core/Analytics";
import { getBeaconConfig } from "~/constants";

const beaconConfig = getBeaconConfig();

export function AnalyticsBootstrap() {
  if (!beaconConfig.enabled) {
    return null;
  }

  return (
    <Analytics
      isEnabled={beaconConfig.enabled}
      isExperimentsEnabled={beaconConfig.experimentsEnabled}
      beaconEndpoint={beaconConfig.endpoint}
      beaconSiteId={beaconConfig.siteId}
      beaconDebug={beaconConfig.debug}
    />
  );
}
