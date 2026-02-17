import { createHmac, timingSafeEqual } from "node:crypto";

export function validateGitHubWebhookSignature(params: {
	payload: string;
	signature?: string;
	secret: string;
}): boolean {
	const { payload, signature, secret } = params;
	if (!signature) {
		return false;
	}

	const hmac = createHmac("sha256", secret);
	const digest = `sha256=${hmac.update(payload).digest("hex")}`;
	const provided = Buffer.from(signature);
	const expected = Buffer.from(digest);
	if (provided.length !== expected.length) {
		return false;
	}

	return timingSafeEqual(provided, expected);
}
