import { readBooleanEnv, readEnvString } from "@ngriffin_uk/polychat-utility-server/env";
import { normaliseHttpOrigin } from "@ngriffin_uk/polychat-utility-server/urls";

import { BEACON_DEFAULT_ENDPOINT, POSTHOG_DEFAULT_HOST } from "./constants.js";
import type { TelemetryEnv } from "./types.js";

export type PostHogAnalyticsConfig = {
  apiKey: string;
  host: string;
};

export type BeaconAnalyticsConfig = {
  endpoint: string;
  siteId: string;
};

export function getPostHogAnalyticsConfig(env: TelemetryEnv): PostHogAnalyticsConfig | null {
  if (!readBooleanEnv(env.POSTHOG_BACKEND_ENABLED, true)) {
    return null;
  }

  const apiKey = readEnvString(env.POSTHOG_PROJECT_API_KEY);
  const host = normaliseHttpOrigin(env.POSTHOG_HOST || POSTHOG_DEFAULT_HOST);

  if (!apiKey || !host) {
    return null;
  }

  return { apiKey, host };
}

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

export function shouldCaptureAiObservability(env: TelemetryEnv): boolean {
  if (!readBooleanEnv(env.AI_OBSERVABILITY_ENABLED, true)) {
    return false;
  }

  const posthogEnabled =
    readBooleanEnv(env.POSTHOG_AI_OBSERVABILITY_ENABLED, true) && !!getPostHogAnalyticsConfig(env);

  return (
    posthogEnabled ||
    !!getBeaconAnalyticsConfig(env) ||
    (!!env.ANALYTICS && typeof env.ANALYTICS.writeDataPoint === "function")
  );
}

export function shouldCaptureAiContent(env: TelemetryEnv): boolean {
  return readBooleanEnv(env.POSTHOG_CAPTURE_AI_CONTENT, false);
}
