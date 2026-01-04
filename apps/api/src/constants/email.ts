export const EMAIL_PROVIDERS = {
	AWS_SES: "aws_ses",
	RESEND: "resend",
} as const;

export const EMAIL_PROVIDER_DEFAULT = EMAIL_PROVIDERS.AWS_SES;

export const AWS_SES_CONFIG = {
	REGION: "us-east-1",
	ENDPOINT: "https://email.us-east-1.amazonaws.com/v2/email/outbound-emails",
} as const;

export const RESEND_CONFIG = {
	ENDPOINT: "https://api.resend.com/emails",
} as const;

export type EmailProvider =
	(typeof EMAIL_PROVIDERS)[keyof typeof EMAIL_PROVIDERS];
