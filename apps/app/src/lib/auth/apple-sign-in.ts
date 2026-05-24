import { APPLE_SIGN_IN_CLIENT_ID } from "~/constants";
import { createNonce } from "~/lib/crypto/nonce";
import { sha256Hex } from "~/lib/crypto/sha256";
import { readCustomEventDetail } from "~/lib/dom/customEvent";
import { loadExternalScript } from "~/lib/dom/loadExternalScript";
import { isRecord, readOptionalString } from "~/lib/objects";
import { joinNonEmptyStrings } from "~/lib/strings/joinNonEmptyStrings";

const APPLE_SIGN_IN_SCRIPT_ID = "apple-sign-in-js";
const APPLE_SIGN_IN_SCRIPT_SRC =
	"https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

interface AppleAuthConfig {
	clientId: string;
	scope: string;
	redirectURI: string;
	state: string;
	nonce: string;
	usePopup: boolean;
}

interface AppleIdAuth {
	init(config: AppleAuthConfig): void;
}

export interface AppleSignInSuccessDetail {
	authorization?: {
		code?: string;
		id_token?: string;
		state?: string;
	};
	user?: {
		email?: string;
		name?: {
			firstName?: string;
			lastName?: string;
		};
	};
}

export interface AppleSignInFailureDetail {
	error?: string;
}

declare global {
	interface Window {
		AppleID?: {
			auth: AppleIdAuth;
		};
	}
}

export function isAppleSignInConfigured(): boolean {
	return Boolean(APPLE_SIGN_IN_CLIENT_ID);
}

export async function configureAppleSignIn(): Promise<{ nonce: string; state: string }> {
	if (!APPLE_SIGN_IN_CLIENT_ID) {
		throw new Error("Apple Sign in is not configured.");
	}

	const nonce = createNonce();
	const state = createNonce();
	const requestNonce = await sha256Hex(nonce);

	if (!window.AppleID?.auth) {
		await loadExternalScript({
			id: APPLE_SIGN_IN_SCRIPT_ID,
			src: APPLE_SIGN_IN_SCRIPT_SRC,
		});
	}

	if (!window.AppleID?.auth) {
		throw new Error("Apple Sign in failed to load.");
	}

	window.AppleID.auth.init({
		clientId: APPLE_SIGN_IN_CLIENT_ID,
		scope: "name email",
		redirectURI: window.location.origin,
		state,
		nonce: requestNonce,
		usePopup: true,
	});

	return { nonce, state };
}

export function getAppleIdentityToken(detail: AppleSignInSuccessDetail): string | null {
	return detail.authorization?.id_token ?? null;
}

export function getAppleState(detail: AppleSignInSuccessDetail): string | null {
	return detail.authorization?.state ?? null;
}

export function getAppleFullName(detail: AppleSignInSuccessDetail): string | undefined {
	const name = detail.user?.name;
	const fullName = joinNonEmptyStrings([name?.firstName, name?.lastName]);

	return fullName || undefined;
}

export function getAppleSignInSuccessDetail(event: Event): AppleSignInSuccessDetail | null {
	const detail = readCustomEventDetail(event);
	if (!isRecord(detail)) {
		return null;
	}

	const authorization = isRecord(detail.authorization)
		? {
				code: readOptionalString(detail.authorization.code),
				id_token: readOptionalString(detail.authorization.id_token),
				state: readOptionalString(detail.authorization.state),
			}
		: undefined;
	const user = readAppleSignInUser(detail.user);

	return { authorization, user };
}

export function getAppleSignInFailureDetail(event: Event): AppleSignInFailureDetail | null {
	const detail = readCustomEventDetail(event);
	if (!isRecord(detail)) {
		return null;
	}

	return {
		error: readOptionalString(detail.error),
	};
}

function readAppleSignInUser(value: unknown): AppleSignInSuccessDetail["user"] | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	const name = isRecord(value.name)
		? {
				firstName: readOptionalString(value.name.firstName),
				lastName: readOptionalString(value.name.lastName),
			}
		: undefined;

	return {
		email: readOptionalString(value.email),
		name,
	};
}
