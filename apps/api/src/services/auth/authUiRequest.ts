import { AuthProtocolError, parseAuthRequest, type AuthRequest } from "@ngriffin_uk/auth-protocol";

type AssistantAuthAction =
	| "start_oauth"
	| "request_magic_link"
	| "start_passkey"
	| "start_webauthn_registration"
	| "continue"
	| "sign_in_direct";

export type AssistantAuthUiRequest = Extract<AuthRequest, { readonly action: AssistantAuthAction }>;

const ASSISTANT_AUTH_ACTIONS = [
	"start_oauth",
	"request_magic_link",
	"start_passkey",
	"start_webauthn_registration",
	"continue",
	"sign_in_direct",
] as const satisfies readonly AssistantAuthAction[];

export function parseAssistantAuthUiRequest(value: unknown): AssistantAuthUiRequest {
	try {
		const request = parseAuthRequest(value, {
			allowedActions: ASSISTANT_AUTH_ACTIONS,
		});
		switch (request.action) {
			case "start_oauth":
			case "request_magic_link":
			case "start_passkey":
			case "start_webauthn_registration":
			case "continue":
			case "sign_in_direct":
				return request;
		}
	} catch (error) {
		if (!(error instanceof AuthProtocolError)) throw error;
	}
	throw new Error("This authentication action is not supported.");
}
