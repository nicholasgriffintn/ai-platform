import type { MessagingProviderId, MessagingProviderMetadata } from "./types";

export const messagingProviderMetadata = [
	{
		id: "twilio-sms",
		name: "Twilio SMS",
		description: "Receive SMS webhooks from Twilio and send concise assistant replies.",
		configurationFields: [
			{
				key: "accountSid",
				label: "Account SID",
				type: "password",
				required: true,
				placeholder: "AC...",
				description: "Used to send replies through the Twilio Messages API.",
			},
			{
				key: "authToken",
				label: "Auth Token",
				type: "password",
				required: true,
				description: "Used to verify Twilio webhook signatures and send replies.",
			},
			{
				key: "fromNumber",
				label: "From Phone Number",
				type: "text",
				placeholder: "+15551234567",
				description: "Required unless a Messaging Service SID is set.",
			},
			{
				key: "messagingServiceSid",
				label: "Messaging Service SID",
				type: "text",
				placeholder: "MG...",
				description: "Optional Twilio Messaging Service used instead of a fixed From number.",
			},
		],
	},
	{
		id: "aws-sms",
		name: "AWS End User Messaging",
		description:
			"Receive signed AWS End User Messaging SMS/RCS inbound events and send replies through the SMS and Voice v2 API.",
		configurationFields: [
			{
				key: "accessKeyId",
				label: "AWS Access Key ID",
				type: "password",
				required: true,
				placeholder: "AKIA...",
				description: "Used to sign AWS End User Messaging API requests.",
			},
			{
				key: "secretAccessKey",
				label: "AWS Secret Access Key",
				type: "password",
				required: true,
				description: "Used to sign AWS End User Messaging API requests.",
			},
			{
				key: "region",
				label: "AWS Region",
				type: "text",
				required: true,
				placeholder: "us-east-1",
				description: "Region for End User Messaging and the signed two-way SNS topic.",
			},
			{
				key: "originationIdentity",
				label: "Origination Identity",
				type: "text",
				required: true,
				placeholder: "pool-... or arn:aws:sms-voice:...",
				description: "Phone number, pool, sender ID, or RCS agent used by SendTextMessage.",
			},
			{
				key: "configurationSetName",
				label: "Configuration Set",
				type: "text",
				placeholder: "polychat-messaging",
				description: "Optional End User Messaging configuration set for event destinations.",
			},
			{
				key: "context",
				label: "Event Context JSON",
				type: "text",
				placeholder: '{"app":"polychat"}',
				description: "Optional JSON object logged to AWS event destinations for each sent message.",
			},
			{
				key: "messageFeedbackEnabled",
				label: "Message Feedback",
				type: "text",
				placeholder: "false",
				description:
					"Optional true/false flag for AWS message feedback events when PutMessageFeedback is used.",
			},
			{
				key: "timeToLive",
				label: "Time To Live",
				type: "text",
				placeholder: "259200",
				description: "Optional AWS delivery TTL in seconds from 5 to 259200.",
			},
			{
				key: "dryRun",
				label: "Dry Run",
				type: "text",
				placeholder: "false",
				description:
					"Optional true/false validation mode. When true, AWS validates messages without sending them.",
			},
			{
				key: "messageType",
				label: "Message Type",
				type: "text",
				placeholder: "TRANSACTIONAL",
				description: "Optional TRANSACTIONAL or PROMOTIONAL message type.",
			},
			{
				key: "maxPrice",
				label: "Max Price",
				type: "text",
				placeholder: "0.05",
				description: "Optional maximum spend per message passed to End User Messaging.",
			},
			{
				key: "keyword",
				label: "Keyword",
				type: "text",
				placeholder: "START",
				description: "Optional keyword for two-way SMS/RCS origination flows.",
			},
			{
				key: "indiaEntityId",
				label: "India Entity ID",
				type: "text",
				description:
					"Optional DLT principal entity ID for text messages sent to recipients in India.",
			},
			{
				key: "indiaTemplateId",
				label: "India Template ID",
				type: "text",
				description: "Optional DLT template ID for text messages sent to recipients in India.",
			},
			{
				key: "protectConfigurationId",
				label: "Protect Configuration",
				type: "text",
				placeholder: "protect-...",
				description: "Optional protect configuration ID or ARN.",
			},
			{
				key: "mediaBucket",
				label: "MMS Media S3 Bucket",
				type: "text",
				placeholder: "polychat-mms-media",
				description:
					"Optional S3 bucket used to copy first-party generated assets before SendMediaMessage.",
			},
			{
				key: "mediaKeyPrefix",
				label: "MMS Media Key Prefix",
				type: "text",
				placeholder: "generated",
				description: "Optional S3 key prefix for generated MMS media uploads.",
			},
		],
	},
] as const satisfies MessagingProviderMetadata[];

export const messagingProviderMetadataById = new Map<
	MessagingProviderId,
	MessagingProviderMetadata
>(messagingProviderMetadata.map((provider) => [provider.id, provider]));

export function getMessagingProviderMetadata(
	providerId: string,
): MessagingProviderMetadata | undefined {
	return messagingProviderMetadataById.get(providerId as MessagingProviderId);
}

export function isMessagingProviderId(providerId: string): providerId is MessagingProviderId {
	return messagingProviderMetadataById.has(providerId as MessagingProviderId);
}

export function listConfigurableMessagingProviders(): MessagingProviderId[] {
	return messagingProviderMetadata.map((provider) => provider.id);
}
