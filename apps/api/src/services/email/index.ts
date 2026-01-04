import { AwsClient } from "aws4fetch";

import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import {
	EMAIL_PROVIDERS,
	EMAIL_PROVIDER_DEFAULT,
	AWS_SES_CONFIG,
	RESEND_CONFIG,
	type EmailProvider,
} from "~/constants/email";
import type { IEnv } from "../../types";

const logger = getLogger({ prefix: "services/email" });

export async function sendEmail(
	env: IEnv,
	email: string,
	subject: string,
	bodyText: string,
	bodyHtml: string,
): Promise<void> {
	const provider = getEmailProvider(env);

	switch (provider) {
		case EMAIL_PROVIDERS.AWS_SES:
			return await sendEmailWithSES(env, email, subject, bodyText, bodyHtml);
		case EMAIL_PROVIDERS.RESEND:
			return await sendEmailWithResend(env, email, subject, bodyText, bodyHtml);
		default:
			throw new AssistantError(
				`Unsupported email provider: ${provider}`,
				ErrorType.CONFIGURATION_ERROR,
			);
	}
}

async function sendEmailWithResend(
	env: IEnv,
	email: string,
	subject: string,
	bodyText: string,
	bodyHtml: string,
): Promise<void> {
	const { RESEND_API_KEY, SES_EMAIL_FROM } = env;

	if (!RESEND_API_KEY || !SES_EMAIL_FROM) {
		throw new AssistantError(
			"Resend configuration missing",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	const requestBody = JSON.stringify({
		from: SES_EMAIL_FROM,
		to: [email],
		subject,
		text: bodyText,
		html: bodyHtml,
	});

	const request = new Request(RESEND_CONFIG.ENDPOINT, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${RESEND_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: requestBody,
	});

	try {
		const response = await fetch(request);

		if (!response.ok) {
			const errorBody = await response.text();
			logger.error("Resend error response:", errorBody);
			throw new AssistantError(
				`Failed to send email: ${response.statusText}`,
				ErrorType.EMAIL_SEND_FAILED,
			);
		}
		logger.info(`Email sent to ${email} via Resend`);
	} catch (error: unknown) {
		if (error instanceof AssistantError) {
			throw error;
		}
		logger.error("Failed to send email via Resend:", { error });
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		throw new AssistantError(
			`Failed to send email: ${errorMessage}`,
			ErrorType.EMAIL_SEND_FAILED,
		);
	}
}

function getEmailProvider(env: IEnv): EmailProvider {
	return (env.EMAIL_PROVIDER as EmailProvider) || EMAIL_PROVIDER_DEFAULT;
}

async function sendEmailWithSES(
	env: IEnv,
	email: string,
	subject: string,
	bodyText: string,
	bodyHtml: string,
): Promise<void> {
	const { AWS_SES_ACCESS_KEY_ID, AWS_SES_SECRET_ACCESS_KEY, SES_EMAIL_FROM } =
		env;

	if (!AWS_SES_ACCESS_KEY_ID || !AWS_SES_SECRET_ACCESS_KEY || !SES_EMAIL_FROM) {
		throw new AssistantError(
			"AWS SES configuration missing",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	const awsClient = new AwsClient({
		accessKeyId: AWS_SES_ACCESS_KEY_ID,
		secretAccessKey: AWS_SES_SECRET_ACCESS_KEY,
		region: AWS_SES_CONFIG.REGION,
	});

	const requestBody = JSON.stringify({
		FromEmailAddress: SES_EMAIL_FROM,
		Destination: {
			ToAddresses: [email],
		},
		Content: {
			Simple: {
				Subject: {
					Data: subject,
					Charset: "UTF-8",
				},
				Body: {
					Text: {
						Data: bodyText,
						Charset: "UTF-8",
					},
					Html: {
						Data: bodyHtml,
						Charset: "UTF-8",
					},
				},
			},
		},
	});

	const contentLength = new TextEncoder().encode(requestBody).length;

	const request = new Request(AWS_SES_CONFIG.ENDPOINT, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Content-Length": contentLength.toString(),
		},
		body: requestBody,
	});

	try {
		const signedRequest = await awsClient.sign(request);
		const response = await fetch(signedRequest);

		if (!response.ok) {
			const errorBody = await response.text();
			logger.error("SES error response:", errorBody);
			throw new AssistantError(
				`Failed to send email: ${response.statusText}`,
				ErrorType.EMAIL_SEND_FAILED,
			);
		}
		logger.info(`Email sent to ${email}`);
	} catch (error: unknown) {
		if (error instanceof AssistantError) {
			throw error;
		}
		logger.error("Failed to send email:", { error });
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		throw new AssistantError(
			`Failed to send email: ${errorMessage}`,
			ErrorType.EMAIL_SEND_FAILED,
		);
	}
}
