import { AwsClient } from "aws4fetch";
import type { Context } from "hono";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { StorageService } from "~/lib/storage";
import { putAwsS3Object } from "~/lib/providers/utils/awsS3";
import { formatProviderError } from "~/lib/providers/utils/errors";
import { base64ToBuffer } from "~/utils/base64";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { safeParseJson } from "~/utils/json";
import { getExtensionFromMimeType } from "~/utils/mime";
import { getStringRecordValue } from "~/utils/objects";
import type {
	AwsSmsCredentials,
	IncomingMessage,
	MessagingControlMessage,
	MessagingProvider,
	MessagingWebhookMessage,
} from "../types";

const SMS_MAX_LENGTH = 1500;
const AWS_END_USER_MESSAGING_SERVICE = "sms-voice";
const AWS_END_USER_MESSAGING_SMS_V2_ENDPOINT_PREFIX = "sms-voice.pinpoint";
const AWS_END_USER_MESSAGING_TARGET_PREFIX = "PinpointSMSVoiceV2";
const AWS_S3_MEDIA_URL_PATTERN = /^s3:\/\/([a-z0-9.-]{3,63})\/.+$/;
const AWS_MMS_MEDIA_MIME_PREFIXES = ["image/", "audio/", "video/"];

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

function normaliseAwsMediaInput(mediaUrls: string[] | undefined): string | null {
	const urls = (mediaUrls ?? []).map((url) => url.trim()).filter(Boolean);
	if (urls.length === 0) {
		return null;
	}
	if (urls.length !== 1) {
		throw new AssistantError(
			"AWS End User Messaging MMS supports exactly one media URL",
			ErrorType.PARAMS_ERROR,
		);
	}
	return urls[0];
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

export function parseIncomingAwsSmsMessage(envelope: SnsEnvelope): IncomingMessage {
	const parsedMessage = safeParseJson<Record<string, unknown>>(envelope.Message);
	const messageRecord = parsedMessage && typeof parsedMessage === "object" ? parsedMessage : {};
	const body =
		parsedMessage && typeof parsedMessage === "object"
			? (getStringRecordValue(messageRecord, "messageBody") ?? "")
			: envelope.Message.trim();
	const from =
		getStringRecordValue(messageRecord, "originationNumber") ??
		getStringRecordValue(messageRecord, "from");
	const to =
		getStringRecordValue(messageRecord, "destinationNumber") ??
		getStringRecordValue(messageRecord, "to");

	if (!from || !body) {
		throw new AssistantError(
			"AWS End User Messaging inbound payload is missing sender or content",
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

	constructor(
		private readonly credentials: AwsSmsCredentials,
		private readonly serviceContext?: ServiceContext,
	) {}

	private buildMmsMediaKey(mimeType: string): string {
		const extension = getExtensionFromMimeType(mimeType, "bin");
		const prefix = this.credentials.mediaKeyPrefix?.replace(/^\/+|\/+$/g, "") || "mms";
		const userId = this.serviceContext?.user?.id ?? "unknown-user";
		return `${prefix}/${userId}/${Date.now()}-${generateId()}.${extension}`;
	}

	private async prepareMmsMediaUrl(mediaUrl: string): Promise<string> {
		if (AWS_S3_MEDIA_URL_PATTERN.test(mediaUrl)) {
			return mediaUrl;
		}

		if (!this.credentials.mediaBucket) {
			throw new AssistantError(
				"AWS End User Messaging MMS media bucket must be configured to send first-party media",
				ErrorType.CONFIGURATION_ERROR,
			);
		}
		if (!this.serviceContext) {
			throw new AssistantError(
				"AWS End User Messaging MMS requires service context to resolve first-party media",
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		const user = this.serviceContext.requireUser();
		const blob = await StorageService.forPrivateAssets(this.serviceContext).getPrivateAssetBlob(
			mediaUrl,
			user.id,
			this.serviceContext.env.API_BASE_URL,
			{ allowedMimePrefixes: AWS_MMS_MEDIA_MIME_PREFIXES },
		);
		if (!blob) {
			throw new AssistantError(
				"AWS End User Messaging MMS media must be an s3:// URL or a first-party private asset URL",
				ErrorType.PARAMS_ERROR,
			);
		}

		const key = this.buildMmsMediaKey(blob.type || "application/octet-stream");
		await putAwsS3Object({
			accessKeyId: this.credentials.accessKeyId,
			secretAccessKey: this.credentials.secretAccessKey,
			region: this.credentials.region,
			bucket: this.credentials.mediaBucket,
			key,
			body: await blob.arrayBuffer(),
			contentType: blob.type || "application/octet-stream",
			errorMessage: "Failed to upload AWS MMS media to S3",
		});

		return `s3://${this.credentials.mediaBucket}/${key}`;
	}

	private async sendAwsJsonOperation(params: {
		operation: "SendMediaMessage" | "SendTextMessage";
		body: Record<string, unknown>;
		errorMessage: string;
	}): Promise<void> {
		const aws = new AwsClient({
			accessKeyId: this.credentials.accessKeyId,
			secretAccessKey: this.credentials.secretAccessKey,
			region: this.credentials.region,
			service: AWS_END_USER_MESSAGING_SERVICE,
		});
		const response = await aws.fetch(
			`https://${AWS_END_USER_MESSAGING_SMS_V2_ENDPOINT_PREFIX}.${this.credentials.region}.amazonaws.com/`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-amz-json-1.0",
					"X-Amz-Target": `${AWS_END_USER_MESSAGING_TARGET_PREFIX}.${params.operation}`,
				},
				body: JSON.stringify(params.body),
			},
		);

		if (!response.ok) {
			throw new AssistantError(
				await formatProviderError(response, params.errorMessage),
				ErrorType.EXTERNAL_API_ERROR,
				response.status,
			);
		}
	}

	private buildCommonSendBody(params: { to: string; body: string }): Record<string, unknown> {
		return {
			ConfigurationSetName: this.credentials.configurationSetName,
			Context: this.credentials.context,
			DestinationPhoneNumber: params.to,
			DryRun: this.credentials.dryRun,
			MaxPrice: this.credentials.maxPrice,
			MessageBody: trimSmsBody(params.body),
			MessageFeedbackEnabled: this.credentials.messageFeedbackEnabled,
			OriginationIdentity: this.credentials.originationIdentity,
			ProtectConfigurationId: this.credentials.protectConfigurationId,
			TimeToLive: this.credentials.timeToLive,
		};
	}

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

		return parseIncomingAwsSmsMessage(envelope);
	}

	async send(params: { to: string; body: string; mediaUrls?: string[] }): Promise<void> {
		const mediaUrl = normaliseAwsMediaInput(params.mediaUrls);
		if (mediaUrl) {
			const preparedMediaUrl = await this.prepareMmsMediaUrl(mediaUrl);
			await this.sendAwsJsonOperation({
				operation: "SendMediaMessage",
				errorMessage: "AWS End User Messaging media send failed",
				body: {
					...this.buildCommonSendBody(params),
					MediaUrls: [preparedMediaUrl],
				},
			});
			return;
		}

		await this.sendAwsJsonOperation({
			operation: "SendTextMessage",
			errorMessage: "AWS End User Messaging send failed",
			body: {
				...this.buildCommonSendBody(params),
				DestinationCountryParameters: this.credentials.destinationCountryParameters,
				Keyword: this.credentials.keyword,
				MessageType: this.credentials.messageType ?? "TRANSACTIONAL",
			},
		});
	}
}
