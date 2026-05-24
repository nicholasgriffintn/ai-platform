import type { IEnv } from "~/types";
import { toArrayBuffer } from "~/utils/buffers";
import { sha256Hex } from "~/utils/crypto";
import { AssistantError, ErrorType } from "~/utils/errors";
import { parseJwtJsonPart, splitCompactJwt } from "~/utils/jwt";
import { isRecord, isStringArray } from "~/utils/objects";
import { compactNonEmptyStrings } from "~/utils/strings";

const APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys";
const APPLE_ISSUER = "https://appleid.apple.com";

type AppleAuthEnv = Pick<IEnv, "APPLE_IOS_CLIENT_ID" | "APPLE_WEB_CLIENT_ID">;

interface AppleIdentityTokenHeader {
	alg: string;
	kid: string;
}

interface AppleIdentityTokenPayload {
	iss: string;
	aud: string | string[];
	exp: number;
	sub: string;
	email?: string;
	email_verified?: boolean | string;
	is_private_email?: boolean | string;
	nonce?: string;
}

interface ApplePublicKey {
	kty: "RSA";
	kid: string;
	use?: string;
	alg?: string;
	n: string;
	e: string;
}

interface ApplePublicKeysResponse {
	keys: ApplePublicKey[];
}

export interface VerifiedAppleIdentity {
	sub: string;
	email?: string;
	emailVerified: boolean;
	isPrivateEmail: boolean;
}

export async function verifyAppleIdentityToken({
	env,
	identityToken,
	nonce,
}: {
	env: AppleAuthEnv;
	identityToken: string;
	nonce: string;
}): Promise<VerifiedAppleIdentity> {
	const allowedClientIds = getAllowedAppleClientIds(env);
	const { header, payload, signingInput, signature } = decodeAppleIdentityToken(identityToken);

	if (header.alg !== "RS256") {
		throw new AssistantError(
			"Unsupported Apple identity token algorithm",
			ErrorType.AUTHENTICATION_ERROR,
			401,
		);
	}

	if (payload.iss !== APPLE_ISSUER) {
		throw new AssistantError(
			"Invalid Apple identity token issuer",
			ErrorType.AUTHENTICATION_ERROR,
			401,
		);
	}

	if (!hasAllowedAudience(payload.aud, allowedClientIds)) {
		throw new AssistantError(
			"Invalid Apple identity token audience",
			ErrorType.AUTHENTICATION_ERROR,
			401,
		);
	}

	if (!payload.sub) {
		throw new AssistantError(
			"Invalid Apple identity token subject",
			ErrorType.AUTHENTICATION_ERROR,
			401,
		);
	}

	const now = Math.floor(Date.now() / 1000);
	if (payload.exp < now) {
		throw new AssistantError("Expired Apple identity token", ErrorType.AUTHENTICATION_ERROR, 401);
	}

	await verifyAppleNonce(payload.nonce, nonce);

	const appleKey = await getApplePublicKey(header.kid);
	const isValidSignature = await verifyAppleSignature({
		key: appleKey,
		signingInput,
		signature,
	});

	if (!isValidSignature) {
		throw new AssistantError(
			"Invalid Apple identity token signature",
			ErrorType.AUTHENTICATION_ERROR,
			401,
		);
	}

	return {
		sub: payload.sub,
		email: payload.email,
		emailVerified: parseAppleBoolean(payload.email_verified),
		isPrivateEmail: parseAppleBoolean(payload.is_private_email),
	};
}

export function getAllowedAppleClientIds(env: AppleAuthEnv): string[] {
	const values = compactNonEmptyStrings([env.APPLE_IOS_CLIENT_ID, env.APPLE_WEB_CLIENT_ID]);

	const uniqueValues = Array.from(new Set(values));

	if (uniqueValues.length === 0) {
		throw new AssistantError("Missing Apple Sign in configuration", ErrorType.CONFIGURATION_ERROR);
	}

	return uniqueValues;
}

function decodeAppleIdentityToken(identityToken: string): {
	header: AppleIdentityTokenHeader;
	payload: AppleIdentityTokenPayload;
	signingInput: Uint8Array;
	signature: Uint8Array;
} {
	const jwtParts = splitCompactJwt(identityToken);

	if (!jwtParts) {
		throw new AssistantError("Invalid Apple identity token", ErrorType.AUTHENTICATION_ERROR, 401);
	}

	const header = parseAppleTokenHeader(jwtParts.encodedHeader);
	const payload = parseAppleTokenPayload(jwtParts.encodedPayload);

	return {
		header,
		payload,
		signingInput: jwtParts.signingInput,
		signature: jwtParts.signature,
	};
}

function parseAppleTokenHeader(encodedHeader: string): AppleIdentityTokenHeader {
	const parsed = parseAppleTokenJson(encodedHeader);

	if (!isRecord(parsed) || typeof parsed.alg !== "string" || typeof parsed.kid !== "string") {
		throw new AssistantError(
			"Invalid Apple identity token header",
			ErrorType.AUTHENTICATION_ERROR,
			401,
		);
	}

	return {
		alg: parsed.alg,
		kid: parsed.kid,
	};
}

function parseAppleTokenPayload(encodedPayload: string): AppleIdentityTokenPayload {
	const parsed = parseAppleTokenJson(encodedPayload);

	if (
		!isRecord(parsed) ||
		typeof parsed.iss !== "string" ||
		!(typeof parsed.aud === "string" || isStringArray(parsed.aud)) ||
		typeof parsed.exp !== "number" ||
		typeof parsed.sub !== "string"
	) {
		throw new AssistantError(
			"Invalid Apple identity token payload",
			ErrorType.AUTHENTICATION_ERROR,
			401,
		);
	}

	return {
		iss: parsed.iss,
		aud: parsed.aud,
		exp: parsed.exp,
		sub: parsed.sub,
		email: typeof parsed.email === "string" ? parsed.email : undefined,
		email_verified: readOptionalBooleanClaim(parsed.email_verified),
		is_private_email: readOptionalBooleanClaim(parsed.is_private_email),
		nonce: typeof parsed.nonce === "string" ? parsed.nonce : undefined,
	};
}

function parseAppleTokenJson(encodedValue: string): unknown {
	try {
		return parseJwtJsonPart(encodedValue);
	} catch {
		throw new AssistantError(
			"Invalid Apple identity token encoding",
			ErrorType.AUTHENTICATION_ERROR,
			401,
		);
	}
}

async function getApplePublicKey(kid: string): Promise<ApplePublicKey> {
	const response = await fetch(APPLE_KEYS_URL);
	if (!response.ok) {
		throw new AssistantError(
			"Unable to fetch Apple public keys",
			ErrorType.AUTHENTICATION_ERROR,
			401,
		);
	}

	const parsed = await response.json();
	if (!isApplePublicKeysResponse(parsed)) {
		throw new AssistantError(
			"Invalid Apple public keys response",
			ErrorType.AUTHENTICATION_ERROR,
			401,
		);
	}

	const key = parsed.keys.find((candidate) => candidate.kid === kid);
	if (!key) {
		throw new AssistantError("Apple public key not found", ErrorType.AUTHENTICATION_ERROR, 401);
	}

	return key;
}

async function verifyAppleSignature({
	key,
	signingInput,
	signature,
}: {
	key: ApplePublicKey;
	signingInput: Uint8Array;
	signature: Uint8Array;
}): Promise<boolean> {
	const jwk: JsonWebKey = {
		kty: key.kty,
		n: key.n,
		e: key.e,
	};
	const algorithm: RsaHashedImportParams = {
		name: "RSASSA-PKCS1-v1_5",
		hash: { name: "SHA-256" },
	};
	const cryptoKey = await crypto.subtle.importKey("jwk", jwk, algorithm, false, ["verify"]);

	return crypto.subtle.verify(
		"RSASSA-PKCS1-v1_5",
		cryptoKey,
		toArrayBuffer(signature),
		toArrayBuffer(signingInput),
	);
}

async function verifyAppleNonce(tokenNonce: string | undefined, rawNonce: string): Promise<void> {
	if (!tokenNonce) {
		throw new AssistantError(
			"Missing Apple identity token nonce",
			ErrorType.AUTHENTICATION_ERROR,
			401,
		);
	}

	const hashedNonce = await sha256Hex(rawNonce);
	if (tokenNonce !== rawNonce && tokenNonce !== hashedNonce) {
		throw new AssistantError(
			"Invalid Apple identity token nonce",
			ErrorType.AUTHENTICATION_ERROR,
			401,
		);
	}
}

function hasAllowedAudience(audience: string | string[], allowedClientIds: string[]): boolean {
	if (Array.isArray(audience)) {
		return audience.some((value) => allowedClientIds.includes(value));
	}

	return allowedClientIds.includes(audience);
}

function parseAppleBoolean(value: boolean | string | undefined): boolean {
	return value === true || value === "true";
}

function readOptionalBooleanClaim(value: unknown): boolean | string | undefined {
	if (typeof value === "boolean" || typeof value === "string") {
		return value;
	}

	return undefined;
}

function isApplePublicKeysResponse(value: unknown): value is ApplePublicKeysResponse {
	return (
		isRecord(value) && Array.isArray(value.keys) && value.keys.every((key) => isApplePublicKey(key))
	);
}

function isApplePublicKey(value: unknown): value is ApplePublicKey {
	return (
		isRecord(value) &&
		value.kty === "RSA" &&
		typeof value.kid === "string" &&
		typeof value.n === "string" &&
		typeof value.e === "string" &&
		(value.use === undefined || typeof value.use === "string") &&
		(value.alg === undefined || typeof value.alg === "string")
	);
}
