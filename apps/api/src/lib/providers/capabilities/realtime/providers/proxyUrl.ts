import { createRealtimeProxyGrant } from "~/lib/realtime/proxy-grant";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

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
  apiBaseUrl,
  env,
  model,
  params,
  path,
  provider,
  sessionId,
  userId,
}: {
  apiBaseUrl?: string;
  env: IEnv;
  model: string;
  params?: Record<string, string | undefined>;
  path: string;
  provider: string;
  sessionId: string;
  userId: number;
}): Promise<{ expiresAt: number; url: string }> {
  const grant = await createRealtimeProxyGrant(env, {
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
