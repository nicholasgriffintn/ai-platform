import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import type { IEnv } from "../../types";

const logger = getLogger({ prefix: "services/email" });

export async function sendEmail(
	env: IEnv,
	email: string,
	subject: string,
	bodyText: string,
	bodyHtml: string,
): Promise<void> {
	const { SES_EMAIL_FROM } = env;

	if (!SES_EMAIL_FROM) {
		throw new AssistantError(
			"Email configuration missing",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	try {
		await env.SEND_EMAIL.send({
			from: SES_EMAIL_FROM,
			to: [email],
			subject,
			text: bodyText,
			html: bodyHtml,
		});
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
