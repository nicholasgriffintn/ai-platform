import { describe, expect, it } from "vitest";

import { verifyHmacSha256Webhook } from "../webhook-signatures";

const encoder = new TextEncoder();

async function createSignature(params: {
	secret: string;
	webhookId: string;
	timestamp: string;
	payload: string;
}): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(params.secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const value = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(`${params.webhookId}.${params.timestamp}.${params.payload}`),
	);
	const base64 = btoa(String.fromCharCode(...new Uint8Array(value)));
	return `v1,${base64}`;
}

describe("verifyHmacSha256Webhook", () => {
	it("accepts a valid signature inside the replay window", async () => {
		const nowMs = Date.parse("2026-08-13T12:00:00.000Z");
		const timestamp = String(Math.floor(nowMs / 1000));
		const request = {
			secret: "webhook-secret",
			webhookId: "msg_123",
			timestamp,
			payload: '{"type":"example"}',
		};

		await expect(
			verifyHmacSha256Webhook({
				...request,
				signature: await createSignature(request),
				nowMs,
			}),
		).resolves.toBe(true);
	});

	it.each([
		["missing signature", ""],
		["unsupported signature version", "v2,abc"],
		["invalid base64", "v1,not base64"],
	])("rejects %s", async (_label, signature) => {
		await expect(
			verifyHmacSha256Webhook({
				secret: "webhook-secret",
				webhookId: "msg_123",
				timestamp: "1786622400",
				payload: "{}",
				signature,
				nowMs: 1_786_622_400_000,
			}),
		).resolves.toBe(false);
	});

	it("rejects a valid signature outside the replay window", async () => {
		const timestamp = "1786622400";
		const request = {
			secret: "webhook-secret",
			webhookId: "msg_123",
			timestamp,
			payload: "{}",
		};

		await expect(
			verifyHmacSha256Webhook({
				...request,
				signature: await createSignature(request),
				nowMs: Number(timestamp) * 1000 + 301_000,
			}),
		).resolves.toBe(false);
	});

	it("rejects a signature created for a different raw payload", async () => {
		const timestamp = "1786622400";
		const signed = {
			secret: "webhook-secret",
			webhookId: "msg_123",
			timestamp,
			payload: '{"trusted":true}',
		};

		await expect(
			verifyHmacSha256Webhook({
				...signed,
				payload: '{"trusted":false}',
				signature: await createSignature(signed),
				nowMs: Number(timestamp) * 1000,
			}),
		).resolves.toBe(false);
	});
});
