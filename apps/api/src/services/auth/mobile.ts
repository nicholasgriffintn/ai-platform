import { AssistantError, ErrorType } from "~/utils/errors";

const MOBILE_AUTH_SCHEME = "polychat:";
const MOBILE_AUTH_HOST = "auth";

export type MobileAuthPath = "/callback" | "/magic-link";

interface MobileOAuthState {
	platform: "mobile";
	redirect_uri: string;
}

export function isAllowedMobileRedirectUri(
	redirectUri: string | undefined,
	path: MobileAuthPath,
): redirectUri is string {
	if (!redirectUri) {
		return false;
	}

	try {
		const url = new URL(redirectUri);

		// Reject embedded credentials, ports, query strings, and fragments on the callback target.
		return (
			url.protocol === MOBILE_AUTH_SCHEME &&
			url.hostname === MOBILE_AUTH_HOST &&
			url.pathname === path &&
			url.username === "" &&
			url.password === "" &&
			url.port === "" &&
			url.search === "" &&
			url.hash === ""
		);
	} catch {
		return false;
	}
}

export function requireMobileRedirectUri(
	redirectUri: string | undefined,
	path: MobileAuthPath,
): string {
	if (!isAllowedMobileRedirectUri(redirectUri, path)) {
		throw new AssistantError("Invalid mobile redirect URI", ErrorType.PARAMS_ERROR, 400);
	}

	return redirectUri;
}

export function buildMobileRedirectUri(
	redirectUri: string,
	params: Record<string, string>,
): string {
	const url = new URL(redirectUri);

	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}

	return url.toString();
}

export function createMobileOAuthState(redirectUri: string): string {
	const state: MobileOAuthState = {
		platform: "mobile",
		redirect_uri: redirectUri,
	};

	return encodeURIComponent(JSON.stringify(state));
}

export function parseMobileOAuthState(state: string | undefined): MobileOAuthState | null {
	if (!state) {
		return null;
	}

	try {
		const parsed = JSON.parse(decodeURIComponent(state)) as Partial<MobileOAuthState>;
		if (parsed.platform === "mobile" && typeof parsed.redirect_uri === "string") {
			return {
				platform: "mobile",
				redirect_uri: parsed.redirect_uri,
			};
		}
	} catch {
		return null;
	}

	return null;
}
