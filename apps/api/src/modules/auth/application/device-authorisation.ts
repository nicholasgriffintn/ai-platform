import type { AuthChallengeRecord } from "@ngriffin_uk/auth-core";
import {
  DEVICE_CODE_EXPIRES_IN_SECONDS,
  DEVICE_CODE_POLL_INTERVAL_SECONDS,
  deviceCredentialScopeSchema,
  formatDeviceUserCode,
  isAppClientScope,
  normaliseDeviceUserCode,
  type DeviceAuthorisation,
  type DeviceAuthorisationDecisionResult,
  type DeviceCodeResponse,
  type DeviceCredentialScope,
  type DeviceTokenError,
  type DeviceTokenResponse,
} from "@ngriffin_uk/polychat-schemas";
import { randomHex, readNonEmptyString, sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { AuthChallengeRepository } from "~/modules/auth/infrastructure/AuthChallengeRepository";
import { createUserApiKey } from "~/modules/user/application/apiKeys";

import { decideAppAuthorisation, isAppRequest } from "./app-authorisation";
import {
  createDeviceRequest,
  DEVICE_CHALLENGE_PROVIDER,
  requestKey,
  requireAppBaseUrl,
} from "./device-requests";

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

function readScope(value: unknown): DeviceCredentialScope {
  return deviceCredentialScopeSchema.catch("full").parse(value);
}

function codeKey(deviceCodeHash: string): Promise<string> {
  return sha256Hex(`device-code:${deviceCodeHash}`);
}

function decisionKey(deviceCodeHash: string): Promise<string> {
  return sha256Hex(`device-decision:${deviceCodeHash}`);
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

export async function startDeviceAuthorisation(
  context: ServiceContext,
  clientName: string,
  scope: DeviceCredentialScope,
  now = new Date(),
): Promise<DeviceCodeResponse> {
  if (isAppClientScope(scope)) {
    throw new AssistantError(
      "That access is only available to its registered app.",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

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
    payload: { clientName, scope },
    createdAt: now,
    expiresAt,
    attempts: 0,
  });

  const userCode = await createDeviceRequest(context, {
    payload: { clientName, scope, deviceCodeHash },
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

  const { plaintextKey } = await createUserApiKey(
    context,
    clientName,
    userId,
    readScope(challenge.payload.scope),
  );

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
    scope: readScope(request.payload.scope),
    verified: isAppRequest(request),
    createdAt: request.createdAt.toISOString(),
    expiresAt: request.expiresAt.toISOString(),
  };
}

export async function decideDeviceAuthorisation(
  context: ServiceContext,
  userCodeInput: string,
  decision: "approve" | "deny",
  now = new Date(),
): Promise<DeviceAuthorisationDecisionResult> {
  const user = context.requireUser();
  const challenges = context.repositories.get(AuthChallengeRepository);
  const request = await challenges.consumeByTokenHash(
    await requestKey(requireUserCode(userCodeInput)),
  );

  if (!request || request.expiresAt.getTime() <= now.getTime()) {
    throw new AssistantError(EXPIRED_OR_USED, ErrorType.NOT_FOUND, 404);
  }

  if (isAppRequest(request)) {
    return decideAppAuthorisation(context, request, user.id, decision, now);
  }

  const deviceCodeHash = readNonEmptyString(request.payload.deviceCodeHash);

  if (!deviceCodeHash) {
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
