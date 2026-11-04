import type { AuthChallengeRecord } from "@ngriffin_uk/auth-core";
import {
  APP_AUTHORISATION_CODE_EXPIRES_IN_SECONDS,
  APP_AUTHORISATION_EXPIRES_IN_SECONDS,
  APP_CLIENTS,
  appClientIdSchema,
  formatDeviceUserCode,
  isAppRedirectUri,
  type AppAuthorisationStart,
  type AppAuthorisationStartResponse,
  type AppTokenRequest,
  type AppTokenResponse,
  type DeviceAuthorisationDecision,
  type DeviceAuthorisationDecisionResult,
} from "@ngriffin_uk/polychat-schemas";
import {
  randomHex,
  readNonEmptyString,
  sha256Base64Url,
  sha256Hex,
} from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { AuthChallengeRepository } from "~/modules/auth/infrastructure/AuthChallengeRepository";
import { createUserApiKey } from "~/modules/user/application/apiKeys";
import { ApiKeyRepository } from "~/modules/user/infrastructure/ApiKeyRepository";

import {
  createDeviceRequest,
  DEVICE_CHALLENGE_PROVIDER,
  requireAppBaseUrl,
} from "./device-requests";

function codeKey(code: string): Promise<string> {
  return sha256Hex(`app-code:${code}`);
}

function allowsLoopbackRedirect(context: ServiceContext): boolean {
  return context.env.ENV === "development";
}

export function isAppRequest(request: AuthChallengeRecord): boolean {
  return Boolean(readNonEmptyString(request.payload.clientId));
}

export async function startAppAuthorisation(
  context: ServiceContext,
  input: AppAuthorisationStart,
  now = new Date(),
): Promise<AppAuthorisationStartResponse> {
  if (!isAppRedirectUri(input.client_id, input.redirect_uri, allowsLoopbackRedirect(context))) {
    throw new AssistantError(
      "That redirect address is not registered for this app.",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const client = APP_CLIENTS[input.client_id];
  const challenges = context.repositories.get(AuthChallengeRepository);

  await challenges.deleteExpiredForProvider(DEVICE_CHALLENGE_PROVIDER, now);

  const userCode = await createDeviceRequest(context, {
    payload: {
      clientId: input.client_id,
      clientName: client.name,
      codeChallenge: input.code_challenge,
      redirectUri: input.redirect_uri,
      scope: client.scope,
      state: input.state,
    },
    createdAt: now,
    expiresAt: new Date(now.getTime() + APP_AUTHORISATION_EXPIRES_IN_SECONDS * 1000),
  });
  const displayCode = encodeURIComponent(formatDeviceUserCode(userCode));

  return {
    authorisation_url: `${requireAppBaseUrl(context)}/device?user_code=${displayCode}`,
    expires_in: APP_AUTHORISATION_EXPIRES_IN_SECONDS,
  };
}

export async function decideAppAuthorisation(
  context: ServiceContext,
  request: AuthChallengeRecord,
  userId: number,
  decision: DeviceAuthorisationDecision["decision"],
  now = new Date(),
): Promise<DeviceAuthorisationDecisionResult> {
  const clientId = appClientIdSchema.parse(request.payload.clientId);
  const redirectUri = readNonEmptyString(request.payload.redirectUri) ?? "";
  const state = readNonEmptyString(request.payload.state);
  const codeChallenge = readNonEmptyString(request.payload.codeChallenge);

  if (
    !state ||
    !codeChallenge ||
    !isAppRedirectUri(clientId, redirectUri, allowsLoopbackRedirect(context))
  ) {
    throw new AssistantError("This request is not valid.", ErrorType.PARAMS_ERROR, 400);
  }

  const target = new URL(redirectUri);

  target.searchParams.set("state", state);

  if (decision === "deny") {
    target.searchParams.set("error", "access_denied");

    return { status: "denied", redirect_url: target.toString() };
  }

  const code = randomHex(64).toLowerCase();

  await context.repositories.get(AuthChallengeRepository).create({
    tokenHash: await codeKey(code),
    provider: DEVICE_CHALLENGE_PROVIDER,
    kind: "custom",
    payload: { clientId, codeChallenge, redirectUri, userId: String(userId) },
    createdAt: now,
    expiresAt: new Date(now.getTime() + APP_AUTHORISATION_CODE_EXPIRES_IN_SECONDS * 1000),
    attempts: 0,
  });

  target.searchParams.set("code", code);

  return { status: "approved", redirect_url: target.toString() };
}

export async function exchangeAppCode(
  context: ServiceContext,
  input: AppTokenRequest,
  now = new Date(),
): Promise<AppTokenResponse | { error: "invalid_grant" }> {
  const record = await context.repositories
    .get(AuthChallengeRepository)
    .consumeByTokenHash(await codeKey(input.code));
  const userId = Number(readNonEmptyString(record?.payload.userId));

  if (
    !record ||
    !userId ||
    record.expiresAt.getTime() <= now.getTime() ||
    record.payload.clientId !== input.client_id ||
    record.payload.redirectUri !== input.redirect_uri ||
    record.payload.codeChallenge !== (await sha256Base64Url(input.code_verifier))
  ) {
    return { error: "invalid_grant" };
  }

  const client = APP_CLIENTS[input.client_id];
  const { metadata, plaintextKey } = await createUserApiKey(
    context,
    client.name,
    userId,
    client.scope,
  );

  await context.repositories
    .get(ApiKeyRepository)
    .deleteOtherApiKeysForScope(userId, client.scope, metadata.id);

  return { access_token: plaintextKey, token_type: "Bearer" };
}
