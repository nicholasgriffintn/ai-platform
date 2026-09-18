import type { MobileWorkNotification } from "@ngriffin_uk/polychat-schemas";
import { base64ToBuffer, stringToBase64Url } from "@ngriffin_uk/polychat-utility-server/base64";
import { encodeBase64Url } from "@ngriffin_uk/polychat-utility-server/base64url";

import type { MobilePushDeviceRecord } from "~/modules/mobile-push/infrastructure/MobilePushRepository";
import type { IEnv } from "~/types";

const TOKEN_LIFETIME_MS = 45 * 60 * 1000;
let cachedProviderToken: { value: string; createdAt: number; keyId: string } | undefined;

type ConfiguredApnsEnv = IEnv &
  Required<Pick<IEnv, "APNS_KEY_ID" | "APNS_TEAM_ID" | "APNS_PRIVATE_KEY" | "APNS_TOPIC">>;

function hasConfiguration(env: IEnv): env is ConfiguredApnsEnv {
  return Boolean(env.APNS_KEY_ID && env.APNS_TEAM_ID && env.APNS_PRIVATE_KEY && env.APNS_TOPIC);
}

export function isApnsConfigured(env: IEnv): boolean {
  return hasConfiguration(env);
}

export async function getApnsProviderToken(env: IEnv): Promise<string | null> {
  if (!hasConfiguration(env)) {
    return null;
  }

  if (
    cachedProviderToken?.keyId === env.APNS_KEY_ID &&
    Date.now() - cachedProviderToken.createdAt < TOKEN_LIFETIME_MS
  ) {
    return cachedProviderToken.value;
  }

  const encodedHeader = stringToBase64Url(JSON.stringify({ alg: "ES256", kid: env.APNS_KEY_ID }));
  const encodedPayload = stringToBase64Url(
    JSON.stringify({ iss: env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) }),
  );
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const privateKeyBytes = base64ToBuffer(
    env.APNS_PRIVATE_KEY.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ""),
  );
  const privateKeyBuffer = Uint8Array.from(privateKeyBytes).buffer;
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  const value = `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;

  cachedProviderToken = { value, createdAt: Date.now(), keyId: env.APNS_KEY_ID };

  return value;
}

function apnsEndpoint(device: MobilePushDeviceRecord): string {
  const host =
    device.environment === "sandbox"
      ? "https://api.sandbox.push.apple.com"
      : "https://api.push.apple.com";

  return `${host}/3/device/${device.token}`;
}

export type ApnsAlertResult =
  | { status: "sent" }
  | { status: "failed"; reason: string; invalidateDevice: boolean };

export async function sendApnsAlert(params: {
  device: MobilePushDeviceRecord;
  notification: MobileWorkNotification;
  providerToken: string;
  topic: string;
  collapseId: string;
}): Promise<ApnsAlertResult> {
  let response: Response;

  try {
    response = await fetch(apnsEndpoint(params.device), {
      method: "POST",
      headers: {
        authorization: `bearer ${params.providerToken}`,
        "apns-topic": params.topic,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-expiration": "0",
        "apns-collapse-id": params.collapseId.slice(0, 64),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        aps: {
          alert: { title: params.notification.title, body: params.notification.body },
          sound: "default",
        },
        polychat: {
          id: params.notification.id,
          kind: params.notification.kind,
          target: params.notification.target,
        },
      }),
    });
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.name : "network_error",
      invalidateDevice: false,
    };
  }

  if (response.ok) {
    return { status: "sent" };
  }

  const failure = await response.json<{ reason?: string }>().catch((): { reason?: string } => ({}));
  const reason = failure.reason ?? `APNs ${response.status}`;

  return {
    status: "failed",
    reason,
    invalidateDevice:
      response.status === 410 || reason === "BadDeviceToken" || reason === "Unregistered",
  };
}
