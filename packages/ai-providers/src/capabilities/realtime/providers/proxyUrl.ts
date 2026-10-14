import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ProviderEnv } from "../../../env.js";
import type { ProviderHost } from "../../../host.js";

export type RealtimeProxyScheme = "websocket" | "https";

export const REALTIME_TRANSCRIPTION_PROXY_PATH = "/realtime/transcription";

export function buildRealtimeProxyUrl({
  apiBaseUrl,
  path,
  params,
  scheme = "websocket",
}: {
  apiBaseUrl?: string;
  path: string;
  params?: Record<string, string | undefined>;
  scheme?: RealtimeProxyScheme;
}): string {
  if (!apiBaseUrl) {
    throw new AssistantError("Missing API base URL", ErrorType.CONFIGURATION_ERROR);
  }

  const url = new URL(path, apiBaseUrl);

  if (scheme === "websocket" && url.protocol === "http:") {
    url.protocol = "ws:";
  } else if (scheme === "websocket" && url.protocol === "https:") {
    url.protocol = "wss:";
  }

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

export async function buildGrantedRealtimeProxyUrl({
  host,
  apiBaseUrl,
  byok,
  env,
  model,
  params,
  path,
  provider,
  scheme,
  sessionId,
  userId,
}: {
  host: ProviderHost;
  apiBaseUrl?: string;
  byok: boolean;
  env: ProviderEnv;
  model: string;
  params?: Record<string, string | undefined>;
  path: string;
  provider: string;
  scheme?: RealtimeProxyScheme;
  sessionId: string;
  userId: number;
}): Promise<{ expiresAt: number; url: string }> {
  if (!host.realtime) {
    throw new AssistantError(
      "Realtime proxy grants are not configured",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const grant = await host.realtime.createProxyGrant(env, {
    byok,
    model,
    provider,
    sessionId,
    userId,
  });

  return {
    expiresAt: grant.expiresAt,
    url: buildRealtimeProxyUrl({
      apiBaseUrl,
      path,
      scheme,
      params: {
        ...params,
        grant: grant.token,
        model,
        provider,
        session_id: sessionId,
      },
    }),
  };
}
