import { createHmac, timingSafeEqual } from "node:crypto";

import { getServiceContext } from "~/lib/context/serviceContext";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/github" });

export async function getGithubConnectionToken(
	userId: number,
	ctx: ReturnType<typeof getServiceContext>,
) {
	const providerId = "github";

	try {
		const token = await ctx.repositories.userSettings.getProviderApiKey(
			userId,
			providerId,
		);
		if (token) {
			return token;
		}
	} catch (error) {
		logger.warn("Failed to load GitHub provider token for sandbox route", {
			user_id: userId,
			provider_id: providerId,
			error_message: error instanceof Error ? error.message : String(error),
		});
	}

	return null;
}

export function validateSignature(
	payload: string,
	signature: string | undefined,
	secret: string,
): boolean {
	if (!signature) return false;
	const hmac = createHmac("sha256", secret);
	const digest = `sha256=${hmac.update(payload).digest("hex")}`;

	const provided = Buffer.from(signature);
	const expected = Buffer.from(digest);
	if (provided.length !== expected.length) return false;

	return timingSafeEqual(provided, expected);
}

export async function postCommentToPR(
	repo: string,
	pr: number,
	body: string,
	token: string,
) {
	const response = await fetch(
		`https://api.github.com/repos/${repo}/issues/${pr}/comments`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
				Accept: "application/vnd.github+json",
			},
			body: JSON.stringify({ body }),
		},
	);

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`GitHub API error (${response.status}): ${errorText.slice(0, 500)}`,
		);
	}
}

export function formatResultComment(result: {
	success: boolean;
	summary?: string;
	diff?: string;
	error?: string;
	responseId?: string;
}): string {
	if (!result.success) {
		return [
			"## Implementation Failed",
			"",
			result.error || "The sandbox task failed with an unknown error.",
			"",
			result.responseId
				? `Response ID: \`${result.responseId}\``
				: "No response ID was stored.",
		].join("\n");
	}

	const safeDiff = (result.diff || "").slice(0, 12000);
	return [
		"## Implementation Complete",
		"",
		result.summary || "Sandbox run completed successfully.",
		"",
		result.responseId ? `Response ID: \`${result.responseId}\`` : "",
		"",
		"<details>",
		"<summary>Diff</summary>",
		"",
		"```diff",
		safeDiff || "(No diff generated)",
		"```",
		"</details>",
	]
		.filter(Boolean)
		.join("\n");
}

export function extractImplementTask(commentBody: string): string | null {
	const match = commentBody.match(/^\/implement\s+([\s\S]+)$/im);
	return match?.[1]?.trim() || null;
}
