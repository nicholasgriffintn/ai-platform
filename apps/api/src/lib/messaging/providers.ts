export const MESSAGING_PROVIDER_IDS = ["twilio-sms", "aws-sms"] as const;

export type MessagingProviderId = (typeof MESSAGING_PROVIDER_IDS)[number];

export const MESSAGING_PROVIDER_LABELS: Record<MessagingProviderId, string> = {
	"twilio-sms": "Twilio SMS",
	"aws-sms": "AWS SMS",
};

export function isMessagingProviderId(providerId: string): providerId is MessagingProviderId {
	return (MESSAGING_PROVIDER_IDS as readonly string[]).includes(providerId);
}
