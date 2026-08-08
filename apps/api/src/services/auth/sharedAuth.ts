import { createAuth } from "@ngriffin_uk/auth-core";
import { magicLinkAuth, type MagicLinkDelivery } from "@ngriffin_uk/auth-magic-link";
import { createAppleDirectAuth } from "@ngriffin_uk/auth-provider-apple";
import { createGitHubAuth } from "@ngriffin_uk/auth-provider-github";
import { webAuthn } from "@ngriffin_uk/auth-webauthn";

import {
	APP_NAME,
	AUTH_SESSION_TTL_MS,
	LOCAL_HOST,
	MAGIC_LINK_EXPIRATION_MINUTES,
	PROD_HOST,
} from "~/constants/app";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { createAssistantUserStore, resolveAssistantEmailUser } from "~/services/auth/authUser";
import { resolveGitHubIdentity } from "~/services/auth/github";
import { createAssistantIdentityStore } from "~/services/auth/identity";
import { appendUrlPath } from "~/utils/urls";

export type { AssistantAuthUser } from "~/services/auth/authUser";

const MAGIC_LINK_TTL_MS = MAGIC_LINK_EXPIRATION_MINUTES * 60 * 1_000;

export function createAssistantAuth(context: ServiceContext) {
	return createAuth({
		users: createAssistantUserStore(context),
		sessions: context.repositories.sessions,
		identities: createAssistantIdentityStore(context),
		challenges: context.repositories.authChallenges,
		sessionTtlMs: AUTH_SESSION_TTL_MS,
		challengeTtlMs: MAGIC_LINK_TTL_MS,
	});
}

export function createAssistantAppleDirectAuth(
	context: ServiceContext,
	clientIds: readonly string[],
) {
	return createAssistantAuth(context).use(createAppleDirectAuth({ clientIds }));
}

export function createAssistantGitHubAuth(context: ServiceContext) {
	const clientId = context.env.GITHUB_CLIENT_ID;
	const clientSecret = context.env.GITHUB_CLIENT_SECRET;
	const apiBaseUrl = context.env.API_BASE_URL;
	if (!clientId || !clientSecret || !apiBaseUrl) {
		throw new TypeError("Missing GitHub OAuth configuration.");
	}
	return createAssistantAuth(context).use(
		createGitHubAuth({
			clientId,
			clientSecret,
			redirectUri: appendUrlPath(apiBaseUrl, "/auth/github/callback"),
			stateStore: context.repositories.oauthStates,
			resolveIdentity: resolveGitHubIdentity,
		}),
	);
}

export function createAssistantMagicLinkAuth(
	context: ServiceContext,
	send: (delivery: MagicLinkDelivery) => Promise<void>,
) {
	return createAssistantAuth(context).use(
		magicLinkAuth({
			resolveUser: (email) => resolveAssistantEmailUser(context, email),
			send,
		}),
	);
}

export function createAssistantWebAuthn(context: ServiceContext) {
	const origin =
		context.env.ENV === "development" ? `http://${LOCAL_HOST}` : `https://${PROD_HOST}`;
	return createAssistantAuth(context).use(
		webAuthn({
			rpId: new URL(origin).hostname,
			rpName: APP_NAME,
			origins: [origin],
			store: context.repositories.webAuthn,
		}),
	);
}
