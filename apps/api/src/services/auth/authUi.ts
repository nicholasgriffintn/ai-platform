import { AuthError } from "@ngriffin_uk/auth-core";
import {
	requireAuthStringValue,
	serializeAuthFlowResult,
	type SerializedAuthFlowResult,
} from "@ngriffin_uk/auth-protocol";
import { parseWebAuthnResponse } from "@ngriffin_uk/auth-webauthn";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { getStringRecordValue } from "~/utils/objects";
import { handleAppleIdentityTokenSignIn } from "~/services/auth/apple";
import { parseAssistantAuthUiRequest } from "~/services/auth/authUiRequest";
import { requestAssistantMagicLink } from "~/services/auth/magicLinkRequest";
import {
	createAssistantAuth,
	createAssistantGitHubAuth,
	createAssistantWebAuthn,
	type AssistantAuthUser,
} from "~/services/auth/sharedAuth";
import { extractSessionIdFromCookies } from "~/services/auth/sessions";

export interface AssistantAuthUiResult {
	readonly result: SerializedAuthFlowResult<AssistantAuthUser["record"]>["result"];
	readonly sessionToken?: string;
}

export async function handleAssistantAuthUiRequest({
	context,
	request,
	input,
}: {
	readonly context: ServiceContext;
	readonly request: Request;
	readonly input: unknown;
}): Promise<AssistantAuthUiResult> {
	const authRequest = parseAssistantAuthUiRequest(input);

	if (authRequest.action === "start_oauth") {
		const provider = authRequest.provider;
		if (provider !== "github") {
			throw new Error("This sign-in provider is not supported.");
		}
		const github = createAssistantGitHubAuth(context);
		const url = await github.providers.github.startAuthorization({
			scopes: ["user:email"],
		});
		return {
			result: {
				status: "redirect_required",
				provider,
				url: url.toString(),
			},
		};
	}

	if (authRequest.action === "request_magic_link") {
		await requestAssistantMagicLink({
			context,
			email: authRequest.values.email,
		});
		return {
			result: {
				status: "completed",
				message: "Check your email for a magic link to sign in.",
			},
		};
	}

	if (authRequest.action === "start_passkey") {
		const auth = createAssistantWebAuthn(context);
		return toClientResult(await auth.providers.webauthn.startAuthentication());
	}

	if (authRequest.action === "start_webauthn_registration") {
		const user = await requireAuthenticatedUser(context, request);
		const auth = createAssistantWebAuthn(context);
		return toClientResult(
			await auth.providers.webauthn.startRegistration({
				userId: user.id,
				userName: user.email,
				displayName: user.record.name || user.email,
			}),
		);
	}

	if (authRequest.action === "continue") {
		if (authRequest.kind !== "webauthn") {
			throw new Error("This authentication challenge is not supported.");
		}
		const values = authRequest.values;
		const ceremony = requireAuthStringValue(values, "ceremony");
		const credential = requireAuthStringValue(values, "credential");
		const token = authRequest.continuationToken;
		const auth = createAssistantWebAuthn(context);
		if (ceremony === "registration") {
			const user = await requireAuthenticatedUser(context, request);
			return toClientResult(
				await auth.providers.webauthn.finishRegistration({
					token,
					response: parseWebAuthnResponse("registration", credential),
					expectedUserId: user.id,
				}),
			);
		}
		if (ceremony === "authentication") {
			return toClientResult(
				await auth.providers.webauthn.finishAuthentication({
					token,
					response: parseWebAuthnResponse("authentication", credential),
				}),
			);
		}
		throw new AuthError("invalid_input", "The WebAuthn ceremony is invalid.");
	}

	if (authRequest.action === "sign_in_direct") {
		if (authRequest.provider !== "apple") {
			throw new Error("This direct sign-in provider is not supported.");
		}
		const values = authRequest.values;
		const fullName = getStringRecordValue(values, "fullName");
		const signedIn = await handleAppleIdentityTokenSignIn({
			context,
			identityToken: requireAuthStringValue(values, "identityToken"),
			nonce: requireAuthStringValue(values, "nonce"),
			...(fullName ? { fullName } : {}),
		});
		return {
			result: { status: "authenticated", user: signedIn.user },
			sessionToken: signedIn.sessionId,
		};
	}

	throw new Error("This authentication action is not supported.");
}

async function requireAuthenticatedUser(
	context: ServiceContext,
	request: Request,
): Promise<AssistantAuthUser> {
	const token = extractSessionIdFromCookies(request.headers.get("Cookie") ?? "");
	const session = token ? await createAssistantAuth(context).authenticate(token) : null;
	if (!session) {
		throw new AuthError("invalid_credentials", "Authentication is required.");
	}
	return session.user;
}

function toClientResult(
	result: Parameters<
		typeof serializeAuthFlowResult<AssistantAuthUser, AssistantAuthUser["record"]>
	>[0],
): AssistantAuthUiResult {
	return serializeAuthFlowResult(result, {
		mapUser: (user) => user.record,
	});
}
