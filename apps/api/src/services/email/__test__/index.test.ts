import { describe, expect, it, vi } from "vitest";

import { sendEmail } from "~/services/email";
import { ErrorType } from "~/utils/errors";

const createEmailHarness = (overrides: Partial<Parameters<typeof sendEmail>[0]> = {}) => {
	const send = vi.fn(async () => ({ messageId: "test-message" }));

	return {
		env: {
			SES_EMAIL_FROM: "Polychat <noreply@email.polychat.app>",
			SEND_EMAIL: { send },
			...overrides,
		},
		send,
	};
};

describe("sendEmail", () => {
	it("sends a single-recipient email through the Cloudflare binding", async () => {
		const { env, send } = createEmailHarness();

		await sendEmail(env, "user@example.com", "Welcome", "Plain text body", "<p>HTML body</p>");

		expect(send).toHaveBeenCalledWith({
			from: "Polychat <noreply@email.polychat.app>",
			to: "user@example.com",
			subject: "Welcome",
			text: "Plain text body",
			html: "<p>HTML body</p>",
		});
	});

	it("fails closed when the email binding is missing", async () => {
		await expect(
			sendEmail(
				createEmailHarness({ SEND_EMAIL: undefined }).env,
				"user@example.com",
				"Welcome",
				"Plain text body",
				"<p>HTML body</p>",
			),
		).rejects.toMatchObject({
			message: "Email configuration missing",
			type: ErrorType.CONFIGURATION_ERROR,
		});
	});

	it("fails closed when the sender address is missing", async () => {
		await expect(
			sendEmail(
				createEmailHarness({ SES_EMAIL_FROM: undefined }).env,
				"user@example.com",
				"Welcome",
				"Plain text body",
				"<p>HTML body</p>",
			),
		).rejects.toMatchObject({
			message: "Email configuration missing",
			type: ErrorType.CONFIGURATION_ERROR,
		});
	});

	it("wraps provider send failures", async () => {
		const { env, send } = createEmailHarness();
		send.mockRejectedValueOnce(new Error("sender not verified"));

		await expect(
			sendEmail(env, "user@example.com", "Welcome", "Plain text body", "<p>HTML body</p>"),
		).rejects.toMatchObject({
			message: "Failed to send email: sender not verified",
			type: ErrorType.EMAIL_SEND_FAILED,
		});
	});
});
