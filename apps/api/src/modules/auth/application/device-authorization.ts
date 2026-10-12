import {
  DEVICE_CODE_EXPIRES_IN_SECONDS,
  DEVICE_CODE_POLL_INTERVAL_SECONDS,
  DEVICE_CODE_SLOW_DOWN_SECONDS,
  DEVICE_USER_CODE_ALPHABET,
  DEVICE_USER_CODE_LENGTH,
  formatDeviceUserCode,
  normaliseDeviceUserCode,
  type DeviceAuthorization,
  type DeviceCodeResponse,
  type DeviceTokenError,
  type DeviceTokenResponse,
} from "@ngriffin_uk/polychat-schemas";
import { randomFromAlphabet, randomHex, sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { DeviceAuthorizationRow } from "~/infrastructure/database/schema";
import { createUserApiKey } from "~/modules/user/application/apiKeys";

export type DevicePollOutcome =
  | { kind: "error"; error: DeviceTokenError; intervalSeconds?: number }
  | { kind: "issue" };

export function evaluateDevicePoll(
  record: Pick<
    DeviceAuthorizationRow,
    "status" | "expires_at" | "last_polled_at" | "interval_seconds"
  > | null,
  now: Date,
): DevicePollOutcome {
  if (!record || record.status === "consumed") {
    return { kind: "error", error: "invalid_grant" };
  }

  if (Date.parse(record.expires_at) <= now.getTime()) {
    return { kind: "error", error: "expired_token" };
  }

  if (record.status === "denied") {
    return { kind: "error", error: "access_denied" };
  }

  if (
    record.last_polled_at &&
    now.getTime() - Date.parse(record.last_polled_at) < record.interval_seconds * 1000
  ) {
    return {
      kind: "error",
      error: "slow_down",
      intervalSeconds: record.interval_seconds + DEVICE_CODE_SLOW_DOWN_SECONDS,
    };
  }

  return record.status === "approved"
    ? { kind: "issue" }
    : { kind: "error", error: "authorization_pending" };
}

function requireAppBaseUrl(context: ServiceContext): string {
  const baseUrl = context.env.APP_BASE_URL;

  if (!baseUrl) {
    throw new AssistantError(
      "Device sign-in is unavailable because the app address is not configured",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  return baseUrl.replace(/\/+$/, "");
}

export async function startDeviceAuthorization(
  context: ServiceContext,
  clientName: string,
  now = new Date(),
): Promise<DeviceCodeResponse> {
  const verificationUri = `${requireAppBaseUrl(context)}/device`;
  const deviceCode = randomHex(64).toLowerCase();
  const userCode = randomFromAlphabet(DEVICE_USER_CODE_LENGTH, DEVICE_USER_CODE_ALPHABET);

  await context.repositories.deviceAuthorizations.create({
    deviceCodeHash: await sha256Hex(deviceCode),
    userCode,
    clientName,
    intervalSeconds: DEVICE_CODE_POLL_INTERVAL_SECONDS,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + DEVICE_CODE_EXPIRES_IN_SECONDS * 1000).toISOString(),
  });

  const displayCode = formatDeviceUserCode(userCode);

  return {
    device_code: deviceCode,
    user_code: displayCode,
    verification_uri: verificationUri,
    verification_uri_complete: `${verificationUri}?user_code=${encodeURIComponent(displayCode)}`,
    expires_in: DEVICE_CODE_EXPIRES_IN_SECONDS,
    interval: DEVICE_CODE_POLL_INTERVAL_SECONDS,
  };
}

export async function pollDeviceAuthorization(
  context: ServiceContext,
  deviceCode: string,
  now = new Date(),
): Promise<{ error: DeviceTokenError } | DeviceTokenResponse> {
  const repository = context.repositories.deviceAuthorizations;
  const deviceCodeHash = await sha256Hex(deviceCode);
  const record = await repository.findByDeviceCodeHash(deviceCodeHash);
  const outcome = evaluateDevicePoll(record, now);

  if (outcome.kind === "error") {
    if (record && (outcome.error === "authorization_pending" || outcome.error === "slow_down")) {
      await repository.recordPoll(
        deviceCodeHash,
        now.toISOString(),
        outcome.intervalSeconds ?? record.interval_seconds,
      );
    }

    return { error: outcome.error };
  }

  const consumed = await repository.consumeApproved(deviceCodeHash, now.toISOString());

  if (!consumed?.user_id) {
    return { error: "invalid_grant" };
  }

  const { plaintextKey } = await createUserApiKey(context, consumed.client_name, consumed.user_id);

  return { access_token: plaintextKey, token_type: "Bearer" };
}

function requireUserCode(input: string): string {
  const userCode = normaliseDeviceUserCode(input);

  if (!userCode) {
    throw new AssistantError(
      "That code is not valid. Check it against your device and try again.",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return userCode;
}

const EXPIRED_OR_USED =
  "This code has expired or was already used. Start sign-in again on your device.";

export async function getDeviceAuthorization(
  context: ServiceContext,
  userCodeInput: string,
  now = new Date(),
): Promise<DeviceAuthorization> {
  context.requireUser();
  const record = await context.repositories.deviceAuthorizations.findPendingByUserCode(
    requireUserCode(userCodeInput),
    now.toISOString(),
  );

  if (!record) {
    throw new AssistantError(EXPIRED_OR_USED, ErrorType.NOT_FOUND, 404);
  }

  return {
    userCode: formatDeviceUserCode(record.user_code),
    clientName: record.client_name,
    createdAt: record.created_at,
    expiresAt: record.expires_at,
  };
}

export async function decideDeviceAuthorization(
  context: ServiceContext,
  userCodeInput: string,
  decision: "approve" | "deny",
  now = new Date(),
): Promise<{ status: "approved" | "denied" }> {
  const user = context.requireUser();
  const status = decision === "approve" ? "approved" : "denied";
  const decided = await context.repositories.deviceAuthorizations.decide({
    userCode: requireUserCode(userCodeInput),
    userId: user.id,
    status,
    decidedAt: now.toISOString(),
  });

  if (!decided) {
    throw new AssistantError(EXPIRED_OR_USED, ErrorType.NOT_FOUND, 404);
  }

  return { status };
}
