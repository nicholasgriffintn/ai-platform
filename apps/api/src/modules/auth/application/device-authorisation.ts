import type { AuthChallengeRecord } from "@ngriffin_uk/auth-core";
import {
  DEVICE_CODE_EXPIRES_IN_SECONDS,
  DEVICE_CODE_POLL_INTERVAL_SECONDS,
  DEVICE_USER_CODE_ALPHABET,
  DEVICE_USER_CODE_LENGTH,
  formatDeviceUserCode,
  normaliseDeviceUserCode,
  type DeviceAuthorisation,
  type DeviceCodeResponse,
  type DeviceTokenError,
  type DeviceTokenResponse,
} from "@ngriffin_uk/polychat-schemas";
import {
  randomFromAlphabet,
  randomHex,
  readNonEmptyString,
  sha256Hex,
} from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { AuthChallengeRepository } from "~/modules/auth/infrastructure/AuthChallengeRepository";
import { createUserApiKey } from "~/modules/user/application/apiKeys";

const DEVICE_CHALLENGE_PROVIDER = "device";
const USER_CODE_ATTEMPTS = 3;
const EXPIRED_OR_USED =
  "This code has expired or was already used. Start sign-in again on your device.";

type DeviceChallenge = Pick<AuthChallengeRecord, "createdAt" | "expiresAt" | "attempts">;

export type DevicePollStep = "expired_token" | "slow_down" | "check_decision";

export function evaluateDevicePoll(challenge: DeviceChallenge, now: Date): DevicePollStep {
  if (challenge.expiresAt.getTime() <= now.getTime()) {
    return "expired_token";
  }

  const elapsedMs = Math.max(0, now.getTime() - challenge.createdAt.getTime());
  const allowedPolls = Math.floor(elapsedMs / (DEVICE_CODE_POLL_INTERVAL_SECONDS * 1000)) + 1;

  return challenge.attempts >= allowedPolls ? "slow_down" : "check_decision";
}

function codeKey(deviceCodeHash: string): Promise<string> {
  return sha256Hex(`device-code:${deviceCodeHash}`);
}

function requestKey(userCode: string): Promise<string> {
  return sha256Hex(`device-request:${userCode}`);
}

function decisionKey(deviceCodeHash: string): Promise<string> {
  return sha256Hex(`device-decision:${deviceCodeHash}`);
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

async function createDeviceRequest(
  context: ServiceContext,
  record: Omit<AuthChallengeRecord, "tokenHash" | "provider" | "kind" | "attempts">,
): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const userCode = randomFromAlphabet(DEVICE_USER_CODE_LENGTH, DEVICE_USER_CODE_ALPHABET);

    try {
      await context.repositories.get(AuthChallengeRepository).create({
        ...record,
        tokenHash: await requestKey(userCode),
        provider: DEVICE_CHALLENGE_PROVIDER,
        kind: "custom",
        attempts: 0,
      });

      return userCode;
    } catch (error) {
      if (attempt >= USER_CODE_ATTEMPTS) {
        throw error;
      }
    }
  }
}

export async function startDeviceAuthorisation(
  context: ServiceContext,
  clientName: string,
  now = new Date(),
): Promise<DeviceCodeResponse> {
  const verificationUri = `${requireAppBaseUrl(context)}/device`;
  const deviceCode = randomHex(64).toLowerCase();
  const deviceCodeHash = await sha256Hex(deviceCode);
  const expiresAt = new Date(now.getTime() + DEVICE_CODE_EXPIRES_IN_SECONDS * 1000);
  const challenges = context.repositories.get(AuthChallengeRepository);

  await challenges.deleteExpiredForProvider(DEVICE_CHALLENGE_PROVIDER, now);
  await challenges.create({
    tokenHash: await codeKey(deviceCodeHash),
    provider: DEVICE_CHALLENGE_PROVIDER,
    kind: "custom",
    payload: { clientName },
    createdAt: now,
    expiresAt,
    attempts: 0,
  });

  const userCode = await createDeviceRequest(context, {
    payload: { clientName, deviceCodeHash },
    createdAt: now,
    expiresAt,
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

export async function pollDeviceAuthorisation(
  context: ServiceContext,
  deviceCode: string,
  now = new Date(),
): Promise<{ error: DeviceTokenError } | DeviceTokenResponse> {
  const challenges = context.repositories.get(AuthChallengeRepository);
  const deviceCodeHash = await sha256Hex(deviceCode);
  const codeHash = await codeKey(deviceCodeHash);
  const challenge = await challenges.findByTokenHash(codeHash);

  if (!challenge || challenge.provider !== DEVICE_CHALLENGE_PROVIDER) {
    return { error: "invalid_grant" };
  }

  const step = evaluateDevicePoll(challenge, now);

  if (step === "expired_token") {
    await challenges.consumeByTokenHash(codeHash);

    return { error: "expired_token" };
  }

  if (step === "slow_down" || !(await challenges.incrementAttempts(codeHash, challenge.attempts))) {
    return { error: "slow_down" };
  }

  const decision = await challenges.consumeByTokenHash(await decisionKey(deviceCodeHash));

  if (!decision) {
    return { error: "authorization_pending" };
  }

  await challenges.consumeByTokenHash(codeHash);

  const userId = Number(readNonEmptyString(decision.payload.userId));
  const clientName = readNonEmptyString(challenge.payload.clientName);

  if (readNonEmptyString(decision.payload.decision) !== "approve" || !userId || !clientName) {
    return { error: "access_denied" };
  }

  const { plaintextKey } = await createUserApiKey(context, clientName, userId);

  return { access_token: plaintextKey, token_type: "Bearer" };
}

export async function getDeviceAuthorisation(
  context: ServiceContext,
  userCodeInput: string,
  now = new Date(),
): Promise<DeviceAuthorisation> {
  context.requireUser();
  const userCode = requireUserCode(userCodeInput);
  const request = await context.repositories
    .get(AuthChallengeRepository)
    .findByTokenHash(await requestKey(userCode));
  const clientName = readNonEmptyString(request?.payload.clientName);

  if (!request || !clientName || request.expiresAt.getTime() <= now.getTime()) {
    throw new AssistantError(EXPIRED_OR_USED, ErrorType.NOT_FOUND, 404);
  }

  return {
    userCode: formatDeviceUserCode(userCode),
    clientName,
    createdAt: request.createdAt.toISOString(),
    expiresAt: request.expiresAt.toISOString(),
  };
}

export async function decideDeviceAuthorisation(
  context: ServiceContext,
  userCodeInput: string,
  decision: "approve" | "deny",
  now = new Date(),
): Promise<{ status: "approved" | "denied" }> {
  const user = context.requireUser();
  const challenges = context.repositories.get(AuthChallengeRepository);
  const request = await challenges.consumeByTokenHash(
    await requestKey(requireUserCode(userCodeInput)),
  );
  const deviceCodeHash = readNonEmptyString(request?.payload.deviceCodeHash);

  if (!request || !deviceCodeHash || request.expiresAt.getTime() <= now.getTime()) {
    throw new AssistantError(EXPIRED_OR_USED, ErrorType.NOT_FOUND, 404);
  }

  await challenges.create({
    tokenHash: await decisionKey(deviceCodeHash),
    provider: DEVICE_CHALLENGE_PROVIDER,
    kind: "custom",
    payload: { decision, userId: String(user.id) },
    createdAt: now,
    expiresAt: request.expiresAt,
    attempts: 0,
  });

  return { status: decision === "approve" ? "approved" : "denied" };
}
