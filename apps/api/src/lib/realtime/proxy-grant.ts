import { importHmacSecret, signJwt, verifyJwt } from "@ngriffin_uk/auth-jwt";

import { API_LOCAL_HOST, API_PROD_HOST, LOCAL_HOST, PROD_HOST } from "~/constants/app";
import {
  reserveRealtimeProxySession,
  type RealtimeProxyReservation,
} from "~/services/realtime/proxy-coordinator/client";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

export const REALTIME_PROXY_GRANT_TTL_SECONDS = 60;

const REALTIME_PROXY_GRANT_AUDIENCE = "assistant-realtime-proxy";
const REALTIME_PROXY_GRANT_PURPOSE = "realtime-proxy";

interface RealtimeProxyGrantScope {
  model: string;
  provider: string;
  sessionId: string;
  userId: number;
}

function requireSigningSecret(env: IEnv): string {
  if (!env.JWT_SECRET) {
    throw new AssistantError(
      "Realtime proxy grants are not configured",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return env.JWT_SECRET;
}

export async function createRealtimeProxyGrant(
  env: IEnv,
  scope: RealtimeProxyGrantScope,
): Promise<{ token: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + REALTIME_PROXY_GRANT_TTL_SECONDS;
  const token = await signJwt(
    {
      aud: REALTIME_PROXY_GRANT_AUDIENCE,
      exp: expiresAt,
      iat: now,
      iss: "assistant",
      jti: generateId(),
      model: scope.model,
      provider: scope.provider,
      purpose: REALTIME_PROXY_GRANT_PURPOSE,
      session_id: scope.sessionId,
      sub: String(scope.userId),
    },
    {
      algorithm: "HS256",
      key: await importHmacSecret(requireSigningSecret(env)),
    },
  );

  return { token, expiresAt };
}

function configuredOrigin(value: string | undefined, fallbackHost: string): string {
  const candidate = value?.trim() || `https://${fallbackHost}`;

  try {
    const url = new URL(candidate);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new TypeError("Unsupported protocol");
    }

    return url.origin;
  } catch {
    throw new AssistantError(
      "Realtime proxy origin is not configured correctly",
      ErrorType.CONFIGURATION_ERROR,
    );
  }
}

function expectedOrigins(env: IEnv): { api: string; app: string } {
  const isDevelopment = env.ENV === "development";

  return {
    api: configuredOrigin(env.API_BASE_URL, isDevelopment ? API_LOCAL_HOST : API_PROD_HOST),
    app: configuredOrigin(env.APP_BASE_URL, isDevelopment ? LOCAL_HOST : PROD_HOST),
  };
}

export function assertRealtimeProxyRequestBoundary(request: Request, env: IEnv): void {
  const expected = expectedOrigins(env);
  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== expected.api) {
    throw new AssistantError("Realtime proxy host is not allowed", ErrorType.FORBIDDEN, 403);
  }

  const host = request.headers.get("Host");

  if (host && host.toLowerCase() !== requestUrl.host.toLowerCase()) {
    throw new AssistantError("Realtime proxy host is not allowed", ErrorType.FORBIDDEN, 403);
  }

  const origin = request.headers.get("Origin");

  if (origin && origin !== expected.app) {
    throw new AssistantError("Realtime proxy origin is not allowed", ErrorType.FORBIDDEN, 403);
  }
}

export async function assertRealtimeProxyGrant({
  env,
  grant,
  model,
  provider,
  request,
  sessionId,
  user,
}: {
  env: IEnv;
  grant: string;
  model: string;
  provider: string;
  request: Request;
  sessionId: string;
  user: IUser;
}): Promise<RealtimeProxyReservation> {
  assertRealtimeProxyRequestBoundary(request, env);

  let claims;

  try {
    claims = await verifyJwt(grant, {
      algorithms: ["HS256"],
      audience: REALTIME_PROXY_GRANT_AUDIENCE,
      issuer: "assistant",
      key: await importHmacSecret(requireSigningSecret(env)),
      maxTokenAgeSeconds: REALTIME_PROXY_GRANT_TTL_SECONDS,
    });
  } catch (cause) {
    throw new AssistantError(
      "Invalid or expired realtime proxy grant",
      ErrorType.AUTHENTICATION_ERROR,
      401,
      { cause },
    );
  }

  if (
    claims["purpose"] !== REALTIME_PROXY_GRANT_PURPOSE ||
    claims.sub !== String(user.id) ||
    claims["provider"] !== provider ||
    claims["model"] !== model ||
    claims["session_id"] !== sessionId
  ) {
    throw new AssistantError(
      "Realtime proxy grant does not match this session",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  if (typeof claims.jti !== "string" || typeof claims.exp !== "number") {
    throw new AssistantError("Invalid realtime proxy grant", ErrorType.AUTHENTICATION_ERROR, 401);
  }

  return reserveRealtimeProxySession({
    env,
    expiresAt: claims.exp,
    jti: claims.jti,
    sessionId,
    userId: user.id,
  });
}

export async function connectReservedRealtimeProxy(
  reservation: RealtimeProxyReservation,
  connect: (onSessionEnd: () => Promise<void>) => Promise<Response>,
): Promise<Response> {
  try {
    const response = await connect(() => reservation.release());

    if (response.status !== 101) {
      await reservation.release();
    }

    return response;
  } catch (error) {
    await reservation.release();
    throw error;
  }
}
