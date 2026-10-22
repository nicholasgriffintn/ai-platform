import { safeDecodeURIComponent } from "@ngriffin_uk/polychat-utility-core";
import { readBooleanEnv, readEnvString } from "@ngriffin_uk/polychat-utility-server/env";
import { normaliseHttpOrigin } from "@ngriffin_uk/polychat-utility-server/urls";

import { BEACON_DEFAULT_ENDPOINT, POSTHOG_DEFAULT_HOST } from "./constants.js";
import type { TelemetryEnv } from "./types.js";

export type PostHogAnalyticsConfig = {
  apiKey: string;
  host: string;
};

export type PostHogFeedbackConfig = {
  surveyId: string;
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

export function getPostHogFeedbackConfig(env: TelemetryEnv): PostHogFeedbackConfig | null {
  if (!getPostHogAnalyticsConfig(env)) {
    return null;
  }

  const surveyId = readEnvString(env.POSTHOG_FEEDBACK_SURVEY_ID);

  return surveyId ? { surveyId } : null;
}

export type OtlpExportConfig = {
  endpoint: string;
  headers: Record<string, string>;
  serviceName: string;
  environment: string | null;
};

const DEFAULT_OTLP_SERVICE_NAME = "polychat-api";

function parseOtlpHeaders(value: string | null): Record<string, string> {
  if (!value) {
    return {};
  }

  return Object.fromEntries(
    value.split(",").flatMap((pair) => {
      const separator = pair.indexOf("=");
      const key = separator > 0 ? pair.slice(0, separator).trim() : "";
      const headerValue = separator > 0 ? pair.slice(separator + 1).trim() : "";

      return key && headerValue
        ? [[safeDecodeURIComponent(key), safeDecodeURIComponent(headerValue)]]
        : [];
    }),
  );
}

export function getOtlpExportConfig(env: TelemetryEnv): OtlpExportConfig | null {
  const endpoint = readEnvString(env.OTEL_EXPORTER_OTLP_ENDPOINT);

  if (!endpoint) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") {
    return null;
  }

  return {
    endpoint: url.toString().replace(/\/+$/, ""),
    headers: parseOtlpHeaders(readEnvString(env.OTEL_EXPORTER_OTLP_HEADERS)),
    serviceName: readEnvString(env.OTEL_SERVICE_NAME) ?? DEFAULT_OTLP_SERVICE_NAME,
    environment: readEnvString(env.ENV),
  };
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
