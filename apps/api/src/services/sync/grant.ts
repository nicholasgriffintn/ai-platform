import { importHmacSecret, signJwt, verifyJwt } from "@ngriffin_uk/auth-jwt";
import { DEVICE_SYNC_GRANT_TTL_SECONDS } from "@ngriffin_uk/polychat-schemas";

import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

const DEVICE_SYNC_GRANT_AUDIENCE = "assistant-device-sync";
const DEVICE_SYNC_GRANT_PURPOSE = "device-sync";

function requireSigningSecret(env: IEnv): string {
  if (!env.JWT_SECRET) {
    throw new AssistantError(
      "Device sync grants are not configured",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return env.JWT_SECRET;
}

export async function createDeviceSyncGrant(
  env: IEnv,
  scope: { userId: number; deviceId: string },
): Promise<{ token: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + DEVICE_SYNC_GRANT_TTL_SECONDS;
  const token = await signJwt(
    {
      aud: DEVICE_SYNC_GRANT_AUDIENCE,
      device_id: scope.deviceId,
      exp: expiresAt,
      iat: now,
      iss: "assistant",
      jti: generateId(),
      purpose: DEVICE_SYNC_GRANT_PURPOSE,
      sub: String(scope.userId),
    },
    { algorithm: "HS256", key: await importHmacSecret(requireSigningSecret(env)) },
  );

  return { token, expiresAt };
}

export async function assertDeviceSyncGrant(params: {
  env: IEnv;
  grant: string;
  deviceId: string;
  userId: number;
}): Promise<void> {
  let claims;

  try {
    claims = await verifyJwt(params.grant, {
      algorithms: ["HS256"],
      audience: DEVICE_SYNC_GRANT_AUDIENCE,
      issuer: "assistant",
      key: await importHmacSecret(requireSigningSecret(params.env)),
      maxTokenAgeSeconds: DEVICE_SYNC_GRANT_TTL_SECONDS,
    });
  } catch (cause) {
    throw new AssistantError(
      "Invalid or expired device sync grant",
      ErrorType.AUTHENTICATION_ERROR,
      401,
      { cause },
    );
  }

  if (
    claims["purpose"] !== DEVICE_SYNC_GRANT_PURPOSE ||
    claims.sub !== String(params.userId) ||
    claims["device_id"] !== params.deviceId
  ) {
    throw new AssistantError(
      "Device sync grant does not match this device",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }
}
