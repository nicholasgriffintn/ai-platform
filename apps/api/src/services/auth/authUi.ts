import type { AuthFlowResult, PublicChallenge } from "@ngriffin_uk/auth-core";
import { AuthError } from "@ngriffin_uk/auth-core";
import { parseWebAuthnResponse } from "@ngriffin_uk/auth-webauthn";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { getStringRecordValue } from "~/utils/objects";
import { handleAppleIdentityTokenSignIn } from "~/services/auth/apple";
import {
	requireAuthUiRequest,
	requireAuthUiString,
	requireAuthUiValue,
	requireAuthUiValues,
} from "~/services/auth/authUiRequest";
import { requestAssistantMagicLink } from "~/services/auth/magicLinkRequest";
import {
	createAssistantAuth,
	createAssistantGitHubAuth,
	createAssistantWebAuthn,
	type AssistantAuthUser,
} from "~/services/auth/sharedAuth";
import { extractSessionIdFromCookies } from "~/services/auth/sessions";

export interface AssistantAuthUiResult {
	readonly result: AssistantAuthUiClientResult;
	readonly sessionToken?: string;
}

interface AuthUiChallenge {
	readonly kind: PublicChallenge["kind"];
	readonly continuationToken: string;
	readonly expiresAt: string;
	readonly parameters?: PublicChallenge["parameters"];
}

type AssistantAuthUiClientResult =
	| {
			readonly status: "authenticated";
			readonly user: unknown;
	  }
	| {
			readonly status: Exclude<
				AuthFlowResult<AssistantAuthUser>["status"],
				"authenticated" | "redirect_required"
			>;
			readonly challenge: AuthUiChallenge;
	  }
	| {
			readonly status: "redirect_required";
			readonly provider: string;
			readonly url: string;
	  }
	| {
			readonly status: "completed";
			readonly message: string;
	  };

export async function handleAssistantAuthUiRequest({
	context,
	request,
	input,
}: {
	readonly context: ServiceContext;
	readonly request: Request;
	readonly input: unknown;
}): Promise<AssistantAuthUiResult> {
	const authRequest = requireAuthUiRequest(input);

	if (authRequest.action === "start_oauth") {
		const provider = requireAuthUiString(authRequest, "provider");
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
			email: requireAuthUiValue(authRequest, "email"),
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
		if (requireAuthUiString(authRequest, "kind") !== "webauthn") {
			throw new Error("This authentication challenge is not supported.");
		}
		const values = requireAuthUiValues(authRequest);
		const ceremony = requireAuthUiString(values, "ceremony");
		const credential = requireAuthUiString(values, "credential");
		const token = requireAuthUiString(authRequest, "continuationToken");
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
		if (requireAuthUiString(authRequest, "provider") !== "apple") {
			throw new Error("This direct sign-in provider is not supported.");
		}
		const values = requireAuthUiValues(authRequest);
		const fullName = getStringRecordValue(values, "fullName");
		const signedIn = await handleAppleIdentityTokenSignIn({
			context,
			identityToken: requireAuthUiString(values, "identityToken"),
			nonce: requireAuthUiString(values, "nonce"),
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

function toClientResult(result: AuthFlowResult<AssistantAuthUser>): AssistantAuthUiResult {
	if (result.status === "authenticated") {
		return {
			result: { status: "authenticated", user: result.session.user.record },
			sessionToken: result.session.token,
		};
	}
	if (result.status === "redirect_required") {
		return {
			result: {
				status: result.status,
				provider: result.provider,
				url: result.url.toString(),
			},
		};
	}
	return {
		result: {
			status: result.status,
			challenge: serializeChallenge(result.challenge),
		},
	};
}

function serializeChallenge(challenge: PublicChallenge): AuthUiChallenge {
	return {
		kind: challenge.kind,
		continuationToken: challenge.continuationToken,
		expiresAt: challenge.expiresAt.toISOString(),
		...(challenge.parameters ? { parameters: challenge.parameters } : {}),
	};
}
