import type { SandboxWebhookCommand } from "@assistant/schemas";

import { githubApiRequest } from "./api-client";

const GITHUB_API_BASE = "https://api.github.com";

function getCommandHeading(command: SandboxWebhookCommand): {
	successHeading: string;
	failureHeading: string;
} {
	switch (command) {
		case "review":
			return {
				successHeading: "Code Review Complete",
				failureHeading: "Code Review Failed",
			};
		case "test":
			return {
				successHeading: "Test Run Complete",
				failureHeading: "Test Run Failed",
			};
		case "fix":
			return {
				successHeading: "Bug Fix Complete",
				failureHeading: "Bug Fix Failed",
			};
		case "implement":
		default:
			return {
				successHeading: "Implementation Complete",
				failureHeading: "Implementation Failed",
			};
	}
}

export function formatSandboxResultComment(params: {
	command?: SandboxWebhookCommand;
	success: boolean;
	summary?: string;
	diff?: string;
	error?: string;
	responseId?: string;
}): string {
	const heading = getCommandHeading(params.command || "implement");

	if (!params.success) {
		return [
			`## ${heading.failureHeading}`,
			"",
			params.error || "The sandbox task failed with an unknown error.",
			"",
			params.responseId
				? `Response ID: \`${params.responseId}\``
				: "No response ID was stored.",
		].join("\n");
	}

	const safeDiff = (params.diff || "").slice(0, 12000);
	const includeDiff = Boolean(safeDiff.trim());

	return [
		`## ${heading.successHeading}`,
		"",
		params.summary || "Sandbox run completed successfully.",
		"",
		params.responseId ? `Response ID: \`${params.responseId}\`` : "",
		...(includeDiff
			? [
					"",
					"<details>",
					"<summary>Diff</summary>",
					"",
					"```diff",
					safeDiff,
					"```",
					"</details>",
				]
			: []),
	]
		.filter(Boolean)
		.join("\n");
}

export async function postCommentToIssueOrPullRequest(params: {
	repo: string;
	issueOrPrNumber: number;
	body: string;
	token: string;
}): Promise<void> {
	await githubApiRequest({
		url: `${GITHUB_API_BASE}/repos/${params.repo}/issues/${params.issueOrPrNumber}/comments`,
		method: "POST",
		bearerToken: params.token,
		body: { body: params.body },
	});
}
