import type { Context } from "hono";

export const MESSAGING_PROVIDER_IDS = ["twilio-sms", "aws-sms"] as const;

export type MessagingProviderId = (typeof MESSAGING_PROVIDER_IDS)[number];

export interface MessagingProviderConfigurationField {
	key: string;
	label: string;
	type: "text" | "password";
	required?: boolean;
	placeholder?: string;
	description?: string;
}

export interface MessagingProviderMetadata {
	id: MessagingProviderId;
	name: string;
	description: string;
	configurationFields: MessagingProviderConfigurationField[];
}

export interface IncomingMessage {
	kind: "message";
	from: string;
	to?: string;
	body: string;
	media?: IncomingMessageMedia[];
	mediaUrls?: string[];
}

export interface IncomingMessageMedia {
	url: string;
	mimeType?: string;
}

export interface MessagingControlMessage {
	kind: "control";
	response: Record<string, unknown>;
}

export type MessagingWebhookMessage = IncomingMessage | MessagingControlMessage;

export interface MessagingProvider {
	id: MessagingProviderId;
	parseIncoming(c: Context): Promise<MessagingWebhookMessage>;
	send(params: { to: string; body: string; mediaUrls?: string[] }): Promise<void>;
}

export interface TwilioSmsCredentials {
	accountSid: string;
	authToken: string;
	fromNumber?: string;
	messagingServiceSid?: string;
}

export interface AwsSmsCredentials {
	accessKeyId: string;
	secretAccessKey: string;
	region: string;
	originationIdentity: string;
	configurationSetName?: string;
	context?: Record<string, string>;
	destinationCountryParameters?: Partial<Record<"IN_ENTITY_ID" | "IN_TEMPLATE_ID", string>>;
	dryRun?: boolean;
	messageFeedbackEnabled?: boolean;
	messageType?: "TRANSACTIONAL" | "PROMOTIONAL";
	maxPrice?: string;
	keyword?: string;
	protectConfigurationId?: string;
	timeToLive?: number;
	mediaBucket?: string;
	mediaKeyPrefix?: string;
}

export type MessagingProviderCredentials = TwilioSmsCredentials | AwsSmsCredentials;
