import { describe, expect, it } from "vitest";

import { verifySandboxJwt } from "../auth";

function toBase64Url(input: string | Uint8Array): string {
	const bytes =
		typeof input === "string" ? new TextEncoder().encode(input) : input;
	return Buffer.from(bytes)
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

async function createToken(payload: Record<string, unknown>, secret: string) {
	const header = {
		alg: "HS256",
		typ: "JWT",
	};
	const headerSegment = toBase64Url(JSON.stringify(header));
	const payloadSegment = toBase64Url(JSON.stringify(payload));
	const signingInput = `${headerSegment}.${payloadSegment}`;

	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = new Uint8Array(
		await crypto.subtle.sign(
			"HMAC",
			key,
			new TextEncoder().encode(signingInput),
		),
	);

	return `${signingInput}.${toBase64Url(signature)}`;
}

describe("verifySandboxJwt", () => {
	it("verifies a valid token and extracts user id", async () => {
		const now = Math.floor(Date.now() / 1000);
		const token = await createToken(
			{
				sub: "42",
				iss: "assistant",
				aud: "assistant",
				iat: now - 10,
				exp: now + 120,
			},
			"secret",
		);

		const decoded = await verifySandboxJwt(token, "secret");

		expect(decoded.userId).toBe(42);
		expect(decoded.payload.sub).toBe("42");
	});

	it("rejects expired tokens", async () => {
		const now = Math.floor(Date.now() / 1000);
		const token = await createToken(
			{
				sub: "42",
				iss: "assistant",
				aud: "assistant",
				iat: now - 300,
				exp: now - 60,
			},
			"secret",
		);

		await expect(verifySandboxJwt(token, "secret")).rejects.toThrow(
			"JWT is expired",
		);
	});

	it("rejects tokens signed with a different secret", async () => {
		const now = Math.floor(Date.now() / 1000);
		const token = await createToken(
			{
				sub: "42",
				iss: "assistant",
				aud: "assistant",
				iat: now - 10,
				exp: now + 120,
			},
			"secret-a",
		);

		await expect(verifySandboxJwt(token, "secret-b")).rejects.toThrow(
			"JWT signature verification failed",
		);
	});
});
