import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { validateGitHubWebhookSignature } from "./signature";

function sign(payload: string, secret: string): string {
	return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

describe("validateGitHubWebhookSignature", () => {
	it("accepts the matching sha256 signature for a payload", () => {
		const payload = JSON.stringify({ action: "opened", repository: "owner/repo" });
		const secret = "webhook-secret";

		expect(
			validateGitHubWebhookSignature({
				payload,
				secret,
				signature: sign(payload, secret),
			}),
		).toBe(true);
	});

	it("rejects missing, mismatched, and malformed-length signatures", () => {
		const payload = JSON.stringify({ action: "opened" });
		const secret = "webhook-secret";

		expect(validateGitHubWebhookSignature({ payload, secret })).toBe(false);
		expect(
			validateGitHubWebhookSignature({
				payload,
				secret,
				signature: sign(payload, "other-secret"),
			}),
		).toBe(false);
		expect(
			validateGitHubWebhookSignature({
				payload,
				secret,
				signature: "sha256=short",
			}),
		).toBe(false);
	});
});
