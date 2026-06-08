import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "hono";

import { bufferToBase64 } from "~/utils/base64";
import { TwilioSmsProvider } from "../TwilioSmsProvider";

async function buildTwilioSignature(
	url: string,
	form: FormData,
	authToken: string,
): Promise<string> {
	const params = Array.from(form.entries())
		.map(([key, value]) => [key, String(value)] as const)
		.sort(([left], [right]) => left.localeCompare(right));
	const signedPayload = `${url}${params.map(([key, value]) => `${key}${value}`).join("")}`;
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(authToken),
		{ name: "HMAC", hash: "SHA-1" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
	return bufferToBase64(new Uint8Array(signature));
}

async function createTwilioContext(form: FormData, url = "https://api.polychat.test/webhooks/sms") {
	const signature = await buildTwilioSignature(url, form, "secret");
	return {
		req: {
			url,
			formData: vi.fn(async () => form),
			header: vi.fn((name: string) => (name === "X-Twilio-Signature" ? signature : undefined)),
		},
	} as unknown as Context;
}

describe("TwilioSmsProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("{}", { status: 201 })),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("sends media URLs with outbound messages", async () => {
		const provider = new TwilioSmsProvider({
			accountSid: "AC123",
			authToken: "secret",
			messagingServiceSid: "MG123",
		});

		await provider.send({
			to: "+15551234567",
			body: "image attached",
			mediaUrls: ["https://assets.polychat.test/image.jpg"],
		});

		const fetchMock = vi.mocked(fetch);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					"Content-Type": "application/x-www-form-urlencoded",
				}),
				body: expect.any(String),
			}),
		);

		const body = new URLSearchParams(String(fetchMock.mock.calls[0][1]?.body));
		expect(body.get("To")).toBe("+15551234567");
		expect(body.get("MessagingServiceSid")).toBe("MG123");
		expect(body.get("Body")).toBe("image attached");
		expect(body.getAll("MediaUrl")).toEqual(["https://assets.polychat.test/image.jpg"]);
	});

	it("rejects outbound S3 media URLs before calling Twilio", async () => {
		const provider = new TwilioSmsProvider({
			accountSid: "AC123",
			authToken: "secret",
			messagingServiceSid: "MG123",
		});

		await expect(
			provider.send({
				to: "+15551234567",
				body: "image attached",
				mediaUrls: ["s3://polychat-mms/generated/image.jpg"],
			}),
		).rejects.toThrow("HTTPS");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("preserves signed inbound Twilio media URLs from the account media API", async () => {
		const provider = new TwilioSmsProvider({
			accountSid: "AC123",
			authToken: "secret",
			messagingServiceSid: "MG123",
		});
		const form = new FormData();
		form.set("From", "+15551234567");
		form.set("To", "+15557654321");
		form.set("Body", "what is this?");
		form.set("NumMedia", "1");
		form.set(
			"MediaUrl0",
			"https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/MM123/Media/ME123",
		);
		form.set("MediaContentType0", "image/jpeg");

		const incoming = await provider.parseIncoming(await createTwilioContext(form));

		expect(incoming).toEqual({
			kind: "message",
			from: "+15551234567",
			to: "+15557654321",
			body: "what is this?",
			media: [
				{
					url: "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/MM123/Media/ME123",
					mimeType: "image/jpeg",
				},
			],
			mediaUrls: ["https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/MM123/Media/ME123"],
		});
	});

	it("ignores signed inbound media URLs outside the Twilio account media API", async () => {
		const provider = new TwilioSmsProvider({
			accountSid: "AC123",
			authToken: "secret",
			messagingServiceSid: "MG123",
		});
		const form = new FormData();
		form.set("From", "+15551234567");
		form.set("To", "+15557654321");
		form.set("Body", "ignore the untrusted attachment");
		form.set("NumMedia", "1");
		form.set("MediaUrl0", "https://example.com/image.jpg");
		form.set("MediaContentType0", "image/jpeg");

		const incoming = await provider.parseIncoming(await createTwilioContext(form));

		expect(incoming).toMatchObject({
			kind: "message",
			body: "ignore the untrusted attachment",
			media: [],
			mediaUrls: [],
		});
	});
});
