import { AwsClient } from "aws4fetch";
import type { Context } from "hono";

import type { CreateChatCompletionsResponse } from "~/types";
import { createServiceContext } from "~/lib/context/serviceContext";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import { AssistantError, ErrorType } from "~/utils/errors";
import { isMessagingProviderId, type MessagingProviderId } from "./providers";

const CREDENTIALS_DELIMITER = "::@@::";
const SMS_MAX_LENGTH = 1500;

interface TwilioSmsCredentials {
	accountSid: string;
	authToken: string;
	fromNumber?: string;
	messagingServiceSid?: string;
}

interface AwsSmsCredentials {
	accessKeyId: string;
	secretAccessKey: string;
	region: string;
	originationNumber?: string;
}

type SmsCredentials = TwilioSmsCredentials | AwsSmsCredentials;

interface IncomingSms {
	from: string;
	to?: string;
	body: string;
}

function parseCredentialParts(value: string): { apiKey: string; details: Record<string, string> } {
	const [apiKey, rawDetails = ""] = value.split(CREDENTIALS_DELIMITER);
	if (!rawDetails.trim()) return { apiKey, details: {} };

	try {
		const parsed = JSON.parse(rawDetails) as Record<string, string>;
		return { apiKey, details: parsed && typeof parsed === "object" ? parsed : {} };
	} catch {
		return { apiKey, details: { secretKey: rawDetails } };
	}
}

function resolveCredentials(
	providerId: MessagingProviderId,
	encryptedValue: string,
): SmsCredentials {
	const { apiKey, details } = parseCredentialParts(encryptedValue);

	if (providerId === "twilio-sms") {
		const authToken = details.authToken || details.secretKey;
		if (!apiKey || !authToken) {
			throw new AssistantError(
				"Twilio SMS credentials are incomplete",
				ErrorType.CONFIGURATION_ERROR,
			);
		}
		return {
			accountSid: apiKey,
			authToken,
			fromNumber: details.fromNumber,
			messagingServiceSid: details.messagingServiceSid,
		};
	}

	const secretAccessKey = details.secretAccessKey || details.secretKey;
	if (!apiKey || !secretAccessKey || !details.region) {
		throw new AssistantError("AWS SMS credentials are incomplete", ErrorType.CONFIGURATION_ERROR);
	}
	return {
		accessKeyId: apiKey,
		secretAccessKey,
		region: details.region,
		originationNumber: details.originationNumber,
	};
}

function trimSmsBody(body: string): string {
	return body.length > SMS_MAX_LENGTH ? `${body.slice(0, SMS_MAX_LENGTH - 1)}…` : body;
}

function extractAssistantText(response: CreateChatCompletionsResponse | Response): string {
	if (response instanceof Response) {
		throw new AssistantError("SMS assistant responses cannot be streamed", ErrorType.PARAMS_ERROR);
	}
	const content = response.choices?.[0]?.message?.content;
	if (typeof content === "string" && content.trim()) return content.trim();
	return "I could not generate a text response.";
}

async function validateTwilioSignature(
	url: string,
	form: FormData,
	authToken: string,
	expectedSignature: string | null,
): Promise<void> {
	if (!expectedSignature) {
		throw new AssistantError("Missing Twilio signature", ErrorType.AUTHENTICATION_ERROR);
	}
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
	const actualSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));

	if (actualSignature !== expectedSignature) {
		throw new AssistantError("Invalid Twilio signature", ErrorType.AUTHENTICATION_ERROR);
	}
}

async function parseIncomingSms(
	c: Context,
	providerId: MessagingProviderId,
	credentials: SmsCredentials,
): Promise<IncomingSms> {
	if (providerId === "twilio-sms") {
		const form = await c.req.formData();
		await validateTwilioSignature(
			c.req.url,
			form,
			(credentials as TwilioSmsCredentials).authToken,
			c.req.header("X-Twilio-Signature") || null,
		);
		const from = String(form.get("From") || "").trim();
		const to = String(form.get("To") || "").trim();
		const body = String(form.get("Body") || "").trim();
		if (!from || !body) {
			throw new AssistantError("Missing Twilio SMS From or Body", ErrorType.PARAMS_ERROR);
		}
		return { from, to, body };
	}

	const payload = await c.req.json().catch(() => ({}) as Record<string, unknown>);
	const message = typeof payload.Message === "string" ? payload.Message : "";
	let parsedMessage: Record<string, unknown> = {};
	try {
		parsedMessage = message ? (JSON.parse(message) as Record<string, unknown>) : {};
	} catch {
		parsedMessage = {};
	}
	const from = String(
		payload.originationNumber || parsedMessage.originationNumber || payload.From || "",
	).trim();
	const to = String(
		payload.destinationNumber || parsedMessage.destinationNumber || payload.To || "",
	).trim();
	const body = String(
		payload.messageBody || parsedMessage.messageBody || payload.Body || message || "",
	).trim();
	if (!from || !body) {
		throw new AssistantError("Missing AWS SMS sender or message body", ErrorType.PARAMS_ERROR);
	}
	return { from, to, body };
}

async function sendTwilioSms(
	credentials: TwilioSmsCredentials,
	to: string,
	body: string,
): Promise<void> {
	const requestBody = new URLSearchParams({ To: to, Body: trimSmsBody(body) });
	if (credentials.messagingServiceSid) {
		requestBody.set("MessagingServiceSid", credentials.messagingServiceSid);
	} else if (credentials.fromNumber) {
		requestBody.set("From", credentials.fromNumber);
	} else {
		throw new AssistantError(
			"Twilio SMS requires a From number or Messaging Service SID",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	const response = await fetch(
		`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(credentials.accountSid)}/Messages.json`,
		{
			method: "POST",
			headers: {
				Authorization: `Basic ${btoa(`${credentials.accountSid}:${credentials.authToken}`)}`,
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

async function sendAwsSms(credentials: AwsSmsCredentials, to: string, body: string): Promise<void> {
	const aws = new AwsClient({
		accessKeyId: credentials.accessKeyId,
		secretAccessKey: credentials.secretAccessKey,
		region: credentials.region,
		service: "sns",
	});
	const requestBody = new URLSearchParams({
		Action: "Publish",
		Version: "2010-03-31",
		PhoneNumber: to,
		Message: trimSmsBody(body),
	});
	if (credentials.originationNumber) {
		requestBody.set("MessageAttributes.entry.1.Name", "AWS.SNS.SMS.SMSType");
		requestBody.set("MessageAttributes.entry.1.Value.DataType", "String");
		requestBody.set("MessageAttributes.entry.1.Value.StringValue", "Transactional");
	}

	const response = await aws.fetch(`https://sns.${credentials.region}.amazonaws.com/`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: requestBody.toString(),
	});
	if (!response.ok) {
		throw new AssistantError(
			`AWS SMS send failed: ${response.statusText}`,
			ErrorType.EXTERNAL_API_ERROR,
		);
	}
}

export async function handleSmsAssistantWebhook(c: Context): Promise<Response> {
	const userId = Number(c.req.param("userId"));
	const providerId = c.req.param("providerId");
	if (!Number.isFinite(userId) || !providerId || !isMessagingProviderId(providerId)) {
		throw new AssistantError("Invalid SMS webhook route", ErrorType.PARAMS_ERROR);
	}

	if (providerId === "aws-sms") {
		const snsPayload = (await c.req.raw
			.clone()
			.json()
			.catch(() => null)) as { Type?: string; SubscribeURL?: string } | null;
		if (snsPayload?.Type === "SubscriptionConfirmation" && snsPayload.SubscribeURL) {
			await fetch(snsPayload.SubscribeURL);
			return c.json({ success: true, message: "AWS SNS subscription confirmed" });
		}
	}

	const repositories = createServiceContext({ env: c.env }).repositories;
	const user = await repositories.users.getUserById(userId);
	if (!user) {
		throw new AssistantError("SMS webhook user not found", ErrorType.NOT_FOUND);
	}

	const context = createServiceContext({ env: c.env, user, requestId: c.get("requestId") });
	const settings = await context.getUserSettings();
	if (!settings?.sms_enabled || settings.sms_provider !== providerId) {
		throw new AssistantError(
			"SMS assistant is not enabled for this provider",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	const encryptedValue = await context.repositories.userSettings.getProviderApiKey(
		userId,
		providerId,
	);
	if (!encryptedValue) {
		throw new AssistantError(
			"SMS provider credentials are not configured",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	const credentials = resolveCredentials(providerId, encryptedValue);
	const incoming = await parseIncomingSms(c, providerId, credentials);
	const completion = await handleCreateChatCompletions({
		env: c.env,
		context,
		user,
		request: {
			model: settings.sms_model || "deepseek-chat",
			provider: settings.sms_model_provider || undefined,
			stream: false,
			messages: [
				{
					role: "system",
					content:
						"You are replying over SMS. Keep responses concise and avoid markdown tables unless asked.",
				},
				{ role: "user", content: incoming.body },
			],
			options: {
				source: "sms",
				from: incoming.from,
				to: incoming.to,
			},
		},
	});
	const assistantText = extractAssistantText(completion);

	if (providerId === "twilio-sms") {
		await sendTwilioSms(credentials as TwilioSmsCredentials, incoming.from, assistantText);
	} else {
		await sendAwsSms(credentials as AwsSmsCredentials, incoming.from, assistantText);
	}

	return c.json({ success: true });
}
