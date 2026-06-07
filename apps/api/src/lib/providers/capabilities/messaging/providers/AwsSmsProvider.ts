import { AwsClient } from "aws4fetch";
import type { Context } from "hono";

import { formatProviderError } from "~/lib/providers/utils/errors";
import { base64ToBuffer } from "~/utils/base64";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";
import { getStringRecordValue } from "~/utils/objects";
import type {
	AwsSmsCredentials,
	IncomingMessage,
	MessagingControlMessage,
	MessagingProvider,
	MessagingWebhookMessage,
} from "../types";

const SMS_MAX_LENGTH = 1500;
const SNS_MESSAGE_TYPE_ATTRIBUTE = "AWS.SNS.SMS.SMSType";
const SNS_SENDER_ID_ATTRIBUTE = "AWS.SNS.SMS.SenderID";

interface SnsEnvelope {
	Type: "Notification" | "SubscriptionConfirmation" | "UnsubscribeConfirmation";
	MessageId: string;
	TopicArn: string;
	Message: string;
	Timestamp: string;
	SignatureVersion: "1" | "2";
	Signature: string;
	SigningCertURL: string;
	Subject?: string;
	SubscribeURL?: string;
	Token?: string;
}

function trimSmsBody(body: string): string {
	return body.length > SMS_MAX_LENGTH ? `${body.slice(0, SMS_MAX_LENGTH - 1)}...` : body;
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}

function parseSnsEnvelope(value: unknown): SnsEnvelope {
	if (!value || typeof value !== "object") {
		throw new AssistantError("AWS SNS payload must be an object", ErrorType.PARAMS_ERROR);
	}

	const record = value as Record<string, unknown>;
	const type = getStringRecordValue(record, "Type");
	const signatureVersion = getStringRecordValue(record, "SignatureVersion");
	if (
		(type !== "Notification" &&
			type !== "SubscriptionConfirmation" &&
			type !== "UnsubscribeConfirmation") ||
		(signatureVersion !== "1" && signatureVersion !== "2")
	) {
		throw new AssistantError("Unsupported AWS SNS payload", ErrorType.PARAMS_ERROR);
	}

	const messageId = getStringRecordValue(record, "MessageId");
	const topicArn = getStringRecordValue(record, "TopicArn");
	const message = getStringRecordValue(record, "Message");
	const timestamp = getStringRecordValue(record, "Timestamp");
	const signature = getStringRecordValue(record, "Signature");
	const signingCertUrl = getStringRecordValue(record, "SigningCertURL");
	const subject = getStringRecordValue(record, "Subject");
	const subscribeUrl = getStringRecordValue(record, "SubscribeURL");
	const token = getStringRecordValue(record, "Token");

	if (!messageId || !topicArn || !message || !timestamp || !signature || !signingCertUrl) {
		throw new AssistantError("AWS SNS payload is incomplete", ErrorType.PARAMS_ERROR);
	}

	if (
		(type === "SubscriptionConfirmation" || type === "UnsubscribeConfirmation") &&
		(!subscribeUrl || !token)
	) {
		throw new AssistantError("AWS SNS subscription payload is incomplete", ErrorType.PARAMS_ERROR);
	}

	return {
		Type: type,
		MessageId: messageId,
		TopicArn: topicArn,
		Message: message,
		Timestamp: timestamp,
		SignatureVersion: signatureVersion,
		Signature: signature,
		SigningCertURL: signingCertUrl,
		Subject: subject,
		SubscribeURL: subscribeUrl,
		Token: token,
	};
}

function assertTopicRegion(topicArn: string, region: string): void {
	const parts = topicArn.split(":");
	if (parts.length < 6 || parts[0] !== "arn" || parts[2] !== "sns" || parts[3] !== region) {
		throw new AssistantError(
			"AWS SNS topic region does not match configuration",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}
}

function validateSnsUrl(rawUrl: string, region: string, options?: { certificate?: boolean }): URL {
	let url: URL;
	try {
		url = new URL(rawUrl);
	} catch {
		throw new AssistantError("AWS SNS URL is invalid", ErrorType.AUTHENTICATION_ERROR);
	}

	if (
		url.protocol !== "https:" ||
		url.username ||
		url.password ||
		url.hostname !== `sns.${region}.amazonaws.com`
	) {
		throw new AssistantError("AWS SNS URL is not trusted", ErrorType.AUTHENTICATION_ERROR);
	}

	if (
		options?.certificate &&
		(!url.pathname.startsWith("/SimpleNotificationService-") || !url.pathname.endsWith(".pem"))
	) {
		throw new AssistantError(
			"AWS SNS signing certificate URL is not trusted",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}

	return url;
}

function buildSnsCanonicalMessage(envelope: SnsEnvelope): string {
	if (envelope.Type === "Notification") {
		const parts = [
			["Message", envelope.Message],
			["MessageId", envelope.MessageId],
		];
		if (envelope.Subject) {
			parts.push(["Subject", envelope.Subject]);
		}
		parts.push(
			["Timestamp", envelope.Timestamp],
			["TopicArn", envelope.TopicArn],
			["Type", envelope.Type],
		);
		return parts.flat().join("\n") + "\n";
	}

	return (
		[
			"Message",
			envelope.Message,
			"MessageId",
			envelope.MessageId,
			"SubscribeURL",
			envelope.SubscribeURL ?? "",
			"Timestamp",
			envelope.Timestamp,
			"Token",
			envelope.Token ?? "",
			"TopicArn",
			envelope.TopicArn,
			"Type",
			envelope.Type,
		].join("\n") + "\n"
	);
}

interface DerElement {
	tag: number;
	start: number;
	end: number;
	bodyStart: number;
	bodyEnd: number;
}

function readDerElement(bytes: Uint8Array, offset: number): DerElement {
	if (offset + 2 > bytes.length) {
		throw new AssistantError("Invalid AWS SNS signing certificate", ErrorType.AUTHENTICATION_ERROR);
	}

	const tag = bytes[offset];
	const lengthByte = bytes[offset + 1];
	let length = 0;
	let headerLength = 2;
	if (lengthByte < 0x80) {
		length = lengthByte;
	} else {
		const lengthBytes = lengthByte & 0x7f;
		if (lengthBytes === 0 || lengthBytes > 4 || offset + 2 + lengthBytes > bytes.length) {
			throw new AssistantError(
				"Invalid AWS SNS signing certificate",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}
		headerLength += lengthBytes;
		for (let index = 0; index < lengthBytes; index += 1) {
			length = (length << 8) | bytes[offset + 2 + index];
		}
	}

	const bodyStart = offset + headerLength;
	const bodyEnd = bodyStart + length;
	if (bodyEnd > bytes.length) {
		throw new AssistantError("Invalid AWS SNS signing certificate", ErrorType.AUTHENTICATION_ERROR);
	}

	return { tag, start: offset, end: bodyEnd, bodyStart, bodyEnd };
}

function readDerChildren(bytes: Uint8Array, element: DerElement): DerElement[] {
	const children: DerElement[] = [];
	let offset = element.bodyStart;
	while (offset < element.bodyEnd) {
		const child = readDerElement(bytes, offset);
		children.push(child);
		offset = child.end;
	}
	if (offset !== element.bodyEnd) {
		throw new AssistantError("Invalid AWS SNS signing certificate", ErrorType.AUTHENTICATION_ERROR);
	}
	return children;
}

function extractSpkiFromCertificate(pem: string): Uint8Array {
	const base64 = pem
		.replace(/-----BEGIN CERTIFICATE-----/g, "")
		.replace(/-----END CERTIFICATE-----/g, "")
		.replace(/\s/g, "");
	const der = base64ToBuffer(base64);
	const certificate = readDerElement(der, 0);
	if (certificate.tag !== 0x30 || certificate.end !== der.length) {
		throw new AssistantError("Invalid AWS SNS signing certificate", ErrorType.AUTHENTICATION_ERROR);
	}

	const certificateChildren = readDerChildren(der, certificate);
	const tbsCertificate = certificateChildren[0];
	if (!tbsCertificate || tbsCertificate.tag !== 0x30) {
		throw new AssistantError("Invalid AWS SNS signing certificate", ErrorType.AUTHENTICATION_ERROR);
	}

	const tbsChildren = readDerChildren(der, tbsCertificate);
	const firstFieldIsVersion = tbsChildren[0]?.tag === 0xa0;
	const subjectPublicKeyInfoIndex = (firstFieldIsVersion ? 1 : 0) + 5;
	const subjectPublicKeyInfo = tbsChildren[subjectPublicKeyInfoIndex];
	if (!subjectPublicKeyInfo || subjectPublicKeyInfo.tag !== 0x30) {
		throw new AssistantError("Invalid AWS SNS signing certificate", ErrorType.AUTHENTICATION_ERROR);
	}

	return der.slice(subjectPublicKeyInfo.start, subjectPublicKeyInfo.end);
}

async function verifySnsSignature(envelope: SnsEnvelope, region: string): Promise<void> {
	assertTopicRegion(envelope.TopicArn, region);
	const certificateUrl = validateSnsUrl(envelope.SigningCertURL, region, { certificate: true });
	const certificateResponse = await fetch(certificateUrl);
	if (!certificateResponse.ok) {
		throw new AssistantError(
			"AWS SNS signing certificate could not be loaded",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}

	const hash = envelope.SignatureVersion === "1" ? "SHA-1" : "SHA-256";
	const key = await crypto.subtle.importKey(
		"spki",
		copyToArrayBuffer(extractSpkiFromCertificate(await certificateResponse.text())),
		{ name: "RSASSA-PKCS1-v1_5", hash },
		false,
		["verify"],
	);
	const verified = await crypto.subtle.verify(
		"RSASSA-PKCS1-v1_5",
		key,
		copyToArrayBuffer(base64ToBuffer(envelope.Signature)),
		new TextEncoder().encode(buildSnsCanonicalMessage(envelope)),
	);
	if (!verified) {
		throw new AssistantError("Invalid AWS SNS signature", ErrorType.AUTHENTICATION_ERROR);
	}
}

function parseIncomingSmsMessage(envelope: SnsEnvelope): IncomingMessage {
	const parsedMessage = safeParseJson<Record<string, unknown>>(envelope.Message);
	const messageRecord = parsedMessage && typeof parsedMessage === "object" ? parsedMessage : {};
	const body = getStringRecordValue(messageRecord, "messageBody") ?? envelope.Message.trim();
	const from =
		getStringRecordValue(messageRecord, "originationNumber") ??
		getStringRecordValue(messageRecord, "from");
	const to =
		getStringRecordValue(messageRecord, "destinationNumber") ??
		getStringRecordValue(messageRecord, "to");

	if (!from || !body) {
		throw new AssistantError(
			"AWS SNS SMS notification is missing sender or body",
			ErrorType.PARAMS_ERROR,
		);
	}

	return { kind: "message", from, to, body };
}

async function confirmSnsSubscription(
	envelope: SnsEnvelope,
	region: string,
): Promise<MessagingControlMessage> {
	if (!envelope.SubscribeURL) {
		throw new AssistantError(
			"AWS SNS subscription confirmation is missing a URL",
			ErrorType.PARAMS_ERROR,
		);
	}

	const subscribeUrl = validateSnsUrl(envelope.SubscribeURL, region);
	const response = await fetch(subscribeUrl);
	if (!response.ok) {
		throw new AssistantError(
			`AWS SNS subscription confirmation failed: ${response.statusText}`,
			ErrorType.EXTERNAL_API_ERROR,
		);
	}

	return {
		kind: "control",
		response: {
			success: true,
			message: "AWS SNS subscription confirmed",
			messageId: envelope.MessageId,
		},
	};
}

export class AwsSmsProvider implements MessagingProvider {
	public readonly id = "aws-sms" as const;

	constructor(private readonly credentials: AwsSmsCredentials) {}

	async parseIncoming(c: Context): Promise<MessagingWebhookMessage> {
		const envelope = parseSnsEnvelope(await c.req.json());
		await verifySnsSignature(envelope, this.credentials.region);

		if (envelope.Type === "SubscriptionConfirmation") {
			return confirmSnsSubscription(envelope, this.credentials.region);
		}
		if (envelope.Type === "UnsubscribeConfirmation") {
			return {
				kind: "control",
				response: {
					success: true,
					message: "AWS SNS unsubscribe confirmation verified",
					messageId: envelope.MessageId,
				},
			};
		}

		return parseIncomingSmsMessage(envelope);
	}

	async send(params: { to: string; body: string }): Promise<void> {
		const requestBody = new URLSearchParams({
			Action: "Publish",
			Version: "2010-03-31",
			PhoneNumber: params.to,
			Message: trimSmsBody(params.body),
			"MessageAttributes.entry.1.Name": SNS_MESSAGE_TYPE_ATTRIBUTE,
			"MessageAttributes.entry.1.Value.DataType": "String",
			"MessageAttributes.entry.1.Value.StringValue": "Transactional",
		});

		if (this.credentials.senderId) {
			requestBody.set("MessageAttributes.entry.2.Name", SNS_SENDER_ID_ATTRIBUTE);
			requestBody.set("MessageAttributes.entry.2.Value.DataType", "String");
			requestBody.set("MessageAttributes.entry.2.Value.StringValue", this.credentials.senderId);
		}

		const aws = new AwsClient({
			accessKeyId: this.credentials.accessKeyId,
			secretAccessKey: this.credentials.secretAccessKey,
			region: this.credentials.region,
			service: "sns",
		});
		const response = await aws.fetch(`https://sns.${this.credentials.region}.amazonaws.com/`, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: requestBody.toString(),
		});

		if (!response.ok) {
			throw new AssistantError(
				await formatProviderError(response, "AWS SNS SMS send failed"),
				ErrorType.EXTERNAL_API_ERROR,
				response.status,
			);
		}
	}
}
