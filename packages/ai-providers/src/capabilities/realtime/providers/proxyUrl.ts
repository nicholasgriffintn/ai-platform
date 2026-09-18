import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ProviderEnv } from "../../../env.js";
import type { ProviderHost } from "../../../host.js";

export function buildRealtimeProxyUrl({
  apiBaseUrl,
  path,
  params,
}: {
  apiBaseUrl?: string;
  path: string;
  params?: Record<string, string | undefined>;
}): string {
  if (!apiBaseUrl) {
    throw new AssistantError("Missing API base URL", ErrorType.CONFIGURATION_ERROR);
  }

  const url = new URL(path, apiBaseUrl);

  if (url.protocol === "http:") {
    url.protocol = "ws:";
  } else if (url.protocol === "https:") {
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
  env,
  model,
  params,
  path,
  provider,
  sessionId,
  userId,
}: {
  host: ProviderHost;
  apiBaseUrl?: string;
  env: ProviderEnv;
  model: string;
  params?: Record<string, string | undefined>;
  path: string;
  provider: string;
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
      params: {
        ...params,
        grant: grant.token,
        model,
        session_id: sessionId,
      },
    }),
  };
}
