import { encodeBase64Url } from "./base64url";

export interface OAuthPkceChallenge {
	codeVerifier: string;
	codeChallenge: string;
	codeChallengeMethod: "S256";
}

export async function generateOAuthPkceChallenge(): Promise<OAuthPkceChallenge> {
	if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
		throw new Error("Secure random generator unavailable");
	}

	const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
	const codeVerifier = encodeBase64Url(verifierBytes);
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));

	return {
		codeVerifier,
		codeChallenge: encodeBase64Url(new Uint8Array(digest)),
		codeChallengeMethod: "S256",
	};
}
