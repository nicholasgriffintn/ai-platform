import { readBooleanEnv, readEnvString } from "@ngriffin_uk/polychat-utility-server/env";
import { normaliseHttpOrigin } from "@ngriffin_uk/polychat-utility-server/urls";

import { BEACON_DEFAULT_ENDPOINT } from "./constants.js";
import type { TelemetryEnv } from "./types.js";

export type BeaconAnalyticsConfig = {
  endpoint: string;
  siteId: string;
};

export function getBeaconAnalyticsConfig(env: TelemetryEnv): BeaconAnalyticsConfig | null {
  if (!readBooleanEnv(env.BEACON_BACKEND_ENABLED, false)) {
    return null;
  }

  const endpoint = normaliseHttpOrigin(env.BEACON_ENDPOINT || BEACON_DEFAULT_ENDPOINT);
  const siteId = readEnvString(env.BEACON_SITE_ID);

  if (!endpoint || !siteId) {
    return null;
  }

  return { endpoint, siteId };
}

export function shouldCaptureAiObservability(
  env: TelemetryEnv,
  { sentry = false }: { sentry?: boolean } = {},
): boolean {
  if (!readBooleanEnv(env.AI_OBSERVABILITY_ENABLED, true)) {
    return false;
  }

  return (
    sentry ||
    !!getBeaconAnalyticsConfig(env) ||
    (!!env.ANALYTICS && typeof env.ANALYTICS.writeDataPoint === "function")
  );
}
