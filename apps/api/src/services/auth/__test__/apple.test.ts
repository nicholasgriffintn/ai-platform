import { beforeEach, describe, expect, it, vi } from "vitest";

import { encodeBase64Url } from "~/utils/base64url";
import { sha256Hex } from "~/utils/crypto";
import { ErrorType } from "~/utils/errors";
import { getAllowedAppleClientIds, verifyAppleIdentityToken } from "~/lib/auth/appleIdentityToken";

const APPLE_PRIVATE_KEY_USAGES: KeyUsage[] = ["sign"];
const APPLE_PUBLIC_KEY_USAGES: KeyUsage[] = ["verify"];

interface TestApplePublicJwk {
	kty: "RSA";
	kid: string;
	use: "sig";
	alg: "RS256";
	n: string;
	e: string;
}

describe("Apple auth service", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("parses configured Apple client IDs", () => {
		expect(
			getAllowedAppleClientIds({
				APPLE_IOS_CLIENT_ID: "com.polychat-app.app",
				APPLE_WEB_CLIENT_ID: "com.polychat.web",
			}),
		).toEqual(["com.polychat.shared", "com.polychat-app.app", "com.polychat.web"]);
	});

	it("verifies a valid Apple identity token", async () => {
		const token = await createAppleIdentityToken({
			aud: "com.polychat-app.app",
			nonce: await sha256Hex("raw-nonce"),
		});

		mockAppleKeys(token.publicJwk);

		const identity = await verifyAppleIdentityToken({
			env: {
				APPLE_IOS_CLIENT_ID: "com.polychat-app.app",
			},
			identityToken: token.jwt,
			nonce: "raw-nonce",
		});

		expect(identity).toEqual({
			sub: "apple-user-sub",
			email: "relay@example.com",
			emailVerified: true,
			isPrivateEmail: true,
		});
	});

	it("rejects identity tokens for another audience", async () => {
		const token = await createAppleIdentityToken({
			aud: "other.client",
			nonce: await sha256Hex("raw-nonce"),
		});

		mockAppleKeys(token.publicJwk);

		await expect(
			verifyAppleIdentityToken({
				env: {
					APPLE_IOS_CLIENT_ID: "com.polychat-app.app",
				},
				identityToken: token.jwt,
				nonce: "raw-nonce",
			}),
		).rejects.toMatchObject({
			message: "Invalid Apple identity token audience",
			type: ErrorType.AUTHENTICATION_ERROR,
		});
	});

	it("rejects identity tokens with a mismatched nonce", async () => {
		const token = await createAppleIdentityToken({
			aud: "com.polychat-app.app",
			nonce: await sha256Hex("raw-nonce"),
		});

		mockAppleKeys(token.publicJwk);

		await expect(
			verifyAppleIdentityToken({
				env: {
					APPLE_IOS_CLIENT_ID: "com.polychat-app.app",
				},
				identityToken: token.jwt,
				nonce: "different-nonce",
			}),
		).rejects.toMatchObject({
			message: "Invalid Apple identity token nonce",
			type: ErrorType.AUTHENTICATION_ERROR,
		});
	});

	it("rejects identity tokens with malformed signature encoding as authentication errors", async () => {
		const encodedHeader = encodeJsonWebTokenPart({
			alg: "RS256",
			kid: "apple-key-id",
		});
		const encodedPayload = encodeJsonWebTokenPart({
			iss: "https://appleid.apple.com",
			aud: "com.polychat-app.app",
			exp: Math.floor(Date.now() / 1000) + 300,
			sub: "apple-user-sub",
			nonce: await sha256Hex("raw-nonce"),
		});

		await expect(
			verifyAppleIdentityToken({
				env: {
					APPLE_IOS_CLIENT_ID: "com.polychat-app.app",
				},
				identityToken: `${encodedHeader}.${encodedPayload}.%%%`,
				nonce: "raw-nonce",
			}),
		).rejects.toMatchObject({
			message: "Invalid Apple identity token",
			statusCode: 401,
			type: ErrorType.AUTHENTICATION_ERROR,
		});
	});
});

async function createAppleIdentityToken({
	aud,
	nonce,
}: {
	aud: string;
	nonce: string;
}): Promise<{ jwt: string; publicJwk: TestApplePublicJwk }> {
	const keyPair = await crypto.subtle.generateKey(
		{
			name: "RSASSA-PKCS1-v1_5",
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: "SHA-256",
		},
		true,
		[...APPLE_PRIVATE_KEY_USAGES, ...APPLE_PUBLIC_KEY_USAGES],
	);
	const exportedPublicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
	if (exportedPublicJwk.kty !== "RSA" || !exportedPublicJwk.n || !exportedPublicJwk.e) {
		throw new Error("Generated test key is not an RSA JWK.");
	}
	const publicJwk: TestApplePublicJwk = {
		kty: "RSA",
		kid: "apple-key-id",
		use: "sig",
		alg: "RS256",
		n: exportedPublicJwk.n,
		e: exportedPublicJwk.e,
	};

	const now = Math.floor(Date.now() / 1000);
	const encodedHeader = encodeJsonWebTokenPart({
		alg: "RS256",
		kid: "apple-key-id",
	});
	const encodedPayload = encodeJsonWebTokenPart({
		iss: "https://appleid.apple.com",
		aud,
		exp: now + 300,
		sub: "apple-user-sub",
		email: "relay@example.com",
		email_verified: "true",
		is_private_email: "true",
		nonce,
	});
	const signingInput = `${encodedHeader}.${encodedPayload}`;
	const signature = await crypto.subtle.sign(
		"RSASSA-PKCS1-v1_5",
		keyPair.privateKey,
		new TextEncoder().encode(signingInput),
	);

	return {
		jwt: `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`,
		publicJwk,
	};
}

function encodeJsonWebTokenPart(value: Record<string, unknown>): string {
	return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function mockAppleKeys(publicJwk: TestApplePublicJwk): void {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				keys: [
					{
						kty: "RSA",
						kid: publicJwk.kid,
						use: publicJwk.use,
						alg: publicJwk.alg,
						n: publicJwk.n,
						e: publicJwk.e,
					},
				],
			}),
		}),
	);
}
