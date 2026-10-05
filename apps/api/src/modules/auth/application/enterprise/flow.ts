import type { OidcLoginQuery } from "@ngriffin_uk/polychat-schemas";
import { randomHex, sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { readCookieValue } from "@ngriffin_uk/polychat-utility-server/http";
import { appendUrlPath } from "@ngriffin_uk/polychat-utility-server/urls";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  buildNativeRedirectUri,
  requireNativeRedirectUri,
} from "~/modules/auth/application/native";
import {
  createSessionCookie,
  generateNativeAuthExchangeCode,
} from "~/modules/auth/application/sessions";

import { requireOidcLinkSession } from "./identity";
import { createEnterpriseOidcProvider } from "./provider";

function flowCookieName(connectionId: string): string {
  return `enterprise-flow-${connectionId}`;
}

function flowCookie(connectionId: string, token: string, maxAge: number): string {
  return `${flowCookieName(connectionId)}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/auth/enterprise/${connectionId}; Max-Age=${maxAge}`;
}

export async function startEnterpriseSignIn(
  context: ServiceContext,
  connectionId: string,
  request: Request,
  options: OidcLoginQuery,
) {
  const { provider } = await createEnterpriseOidcProvider(context, connectionId);
  const browserToken = randomHex(64);
  const stateContext: Record<string, string> = { browserHash: await sha256Hex(browserToken) };

  const nativePlatform =
    options.platform === "mobile" || options.platform === "desktop" ? options.platform : undefined;

  if (nativePlatform) {
    stateContext.nativeRedirectUri = requireNativeRedirectUri(
      options.redirect_uri,
      "/callback",
      nativePlatform,
    );
    stateContext.nativePlatform = nativePlatform;
    if (options.client_state) {
      stateContext.nativeClientState = options.client_state;
    } else if (nativePlatform === "desktop") {
      throw new AssistantError(
        "Desktop sign-in requires a client state",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  }

  if (options.link) {
    const session = await requireOidcLinkSession(context, request.headers.get("cookie") ?? "");

    stateContext.linkUserId = String(session.userId);
    stateContext.linkSessionHash = session.tokenHash;
  }

  const url = await provider.startAuthorization({ context: stateContext });

  return { url: url.toString(), cookie: flowCookie(connectionId, browserToken, 600) };
}

export async function completeEnterpriseSignIn(
  context: ServiceContext,
  connectionId: string,
  request: Request,
  params: {
    code: string;
    state: string;
  },
) {
  const cookies = request.headers.get("cookie") ?? "";
  const browserToken = readCookieValue(cookies, flowCookieName(connectionId));

  if (!browserToken || !/^[A-F0-9]{64}$/.test(browserToken)) {
    throw new AssistantError(
      "Restart enterprise sign-in in this browser",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  const { provider } = await createEnterpriseOidcProvider(context, connectionId, {
    browserToken,
    cookies,
  });
  const result = await provider.completeAuthorization(params);

  if (result.status !== "authenticated") {
    throw new AssistantError(
      "Enterprise sign-in did not complete",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  const continuation = result.session.user.continuation;

  if (continuation?.nativeRedirectUri && continuation.nativePlatform) {
    const redirectUri = requireNativeRedirectUri(
      continuation.nativeRedirectUri,
      "/callback",
      continuation.nativePlatform,
    );
    const { code } = await generateNativeAuthExchangeCode({
      context,
      userId: result.session.user.record.id,
      sessionId: result.session.token,
    });

    return {
      url: buildNativeRedirectUri(redirectUri, {
        code,
        ...(continuation.nativeClientState ? { state: continuation.nativeClientState } : {}),
      }),
      flowCookie: flowCookie(connectionId, "", 0),
    };
  }

  if (!context.env.APP_BASE_URL) {
    throw new AssistantError(
      "Application callback URL is not configured",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  return {
    url: appendUrlPath(context.env.APP_BASE_URL, "auth/callback"),
    sessionCookie: createSessionCookie(result.session.token),
    flowCookie: flowCookie(connectionId, "", 0),
  };
}
