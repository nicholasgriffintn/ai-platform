import { readEnvString } from "@ngriffin_uk/polychat-utility-server/env";
import {
  parseEncodedHeaderPairs,
  parsePublicHttpUrl,
} from "@ngriffin_uk/polychat-utility-server/http";

import { BACKEND_ANALYTICS_APP_NAME } from "./constants.js";
import type { TelemetryEnv } from "./types.js";

export interface OtlpConfig {
  endpoint: string;
  headers: Record<string, string>;
  serviceName: string;
}

export function parseOtlpEndpoint(value: string): string {
  const url = parsePublicHttpUrl(value);

  if (url.protocol !== "https:" || url.search || url.hash) {
    throw new Error("OTLP collector requires a public HTTPS endpoint without query or fragment");
  }

  return url.toString();
}

export function getOtlpConfig(env: TelemetryEnv): OtlpConfig | null {
  const endpoint = readEnvString(env.OTEL_EXPORTER_OTLP_ENDPOINT);

  if (!endpoint) {
    return null;
  }

  try {
    const serviceName = readEnvString(env.OTEL_SERVICE_NAME) ?? BACKEND_ANALYTICS_APP_NAME;

    if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(serviceName)) {
      return null;
    }

    return {
      endpoint: parseOtlpEndpoint(endpoint),
      headers: parseEncodedHeaderPairs(env.OTEL_EXPORTER_OTLP_HEADERS ?? ""),
      serviceName,
    };
  } catch {
    return null;
  }
}
