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
		name: "AWS SMS",
		description:
			"Receive AWS SNS SMS notifications, confirm SNS subscriptions, and send replies through SNS.",
		configurationFields: [
			{
				key: "accessKeyId",
				label: "AWS Access Key ID",
				type: "password",
				required: true,
				placeholder: "AKIA...",
				description: "Used to send SMS replies through Amazon SNS.",
			},
			{
				key: "secretAccessKey",
				label: "AWS Secret Access Key",
				type: "password",
				required: true,
				description: "Used to sign Amazon SNS Publish requests.",
			},
			{
				key: "region",
				label: "AWS Region",
				type: "text",
				required: true,
				placeholder: "us-east-1",
				description: "Region for the SNS topic and outbound SMS publish requests.",
			},
			{
				key: "senderId",
				label: "Sender ID",
				type: "text",
				placeholder: "Polychat",
				description: "Optional SMS sender ID sent as an SNS message attribute where supported.",
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
