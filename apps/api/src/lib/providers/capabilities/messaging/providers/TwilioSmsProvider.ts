import type { Context } from "hono";

import { bufferToBase64 } from "~/utils/base64";
import { AssistantError, ErrorType } from "~/utils/errors";
import type { IncomingMessage, MessagingProvider, TwilioSmsCredentials } from "../types";

const SMS_MAX_LENGTH = 1500;

function trimSmsBody(body: string): string {
	return body.length > SMS_MAX_LENGTH ? `${body.slice(0, SMS_MAX_LENGTH - 1)}...` : body;
}

function timingSafeEqual(left: string, right: string): boolean {
	const leftBytes = new TextEncoder().encode(left);
	const rightBytes = new TextEncoder().encode(right);
	if (leftBytes.length !== rightBytes.length) {
		return false;
	}

	let diff = 0;
	for (let index = 0; index < leftBytes.length; index += 1) {
		diff |= leftBytes[index] ^ rightBytes[index];
	}
	return diff === 0;
}

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

export class TwilioSmsProvider implements MessagingProvider {
	public readonly id = "twilio-sms" as const;

	constructor(private readonly credentials: TwilioSmsCredentials) {}

	async parseIncoming(c: Context): Promise<IncomingMessage> {
		const form = await c.req.formData();
		const expectedSignature = c.req.header("X-Twilio-Signature");
		if (!expectedSignature) {
			throw new AssistantError("Missing Twilio signature", ErrorType.AUTHENTICATION_ERROR);
		}

		const actualSignature = await buildTwilioSignature(c.req.url, form, this.credentials.authToken);
		if (!timingSafeEqual(actualSignature, expectedSignature)) {
			throw new AssistantError("Invalid Twilio signature", ErrorType.AUTHENTICATION_ERROR);
		}

		const from = String(form.get("From") || "").trim();
		const to = String(form.get("To") || "").trim();
		const body = String(form.get("Body") || "").trim();
		if (!from || !body) {
			throw new AssistantError("Missing Twilio SMS From or Body", ErrorType.PARAMS_ERROR);
		}

		return { kind: "message", from, to, body };
	}

	async send(params: { to: string; body: string }): Promise<void> {
		const requestBody = new URLSearchParams({
			To: params.to,
			Body: trimSmsBody(params.body),
		});
		if (this.credentials.messagingServiceSid) {
			requestBody.set("MessagingServiceSid", this.credentials.messagingServiceSid);
		} else if (this.credentials.fromNumber) {
			requestBody.set("From", this.credentials.fromNumber);
		} else {
			throw new AssistantError(
				"Twilio SMS requires a From phone number or Messaging Service SID",
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		const response = await fetch(
			`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
				this.credentials.accountSid,
			)}/Messages.json`,
			{
				method: "POST",
				headers: {
					Authorization: `Basic ${btoa(
						`${this.credentials.accountSid}:${this.credentials.authToken}`,
					)}`,
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: requestBody.toString(),
			},
		);

		if (!response.ok) {
			throw new AssistantError(
				`Twilio SMS send failed: ${response.statusText}`,
				ErrorType.EXTERNAL_API_ERROR,
			);
		}
	}
}
