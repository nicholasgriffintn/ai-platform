import { createHmac, timingSafeEqual } from "node:crypto";

import { githubApiRequest } from "~/services/github/api-client";
import { createGitHubAppJwt } from "~/services/github/app-jwt";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/github" });
const GITHUB_API_BASE = "https://api.github.com";

async function getInstallationIdForRepo(
	repo: string,
	appJwt: string,
): Promise<number> {
	const response = await githubApiRequest({
		url: `${GITHUB_API_BASE}/repos/${repo}/installation`,
		method: "GET",
		bearerToken: appJwt,
	});
	const data = (await response.json()) as { id?: number };

	if (!data.id) {
		throw new Error(`No GitHub App installation found for ${repo}`);
	}

	return data.id;
}

export async function getGitHubAppInstallationToken({
	appId,
	privateKey,
	repo,
	installationId,
}: {
	appId: string;
	privateKey: string;
	repo?: string;
	installationId?: number;
}): Promise<string> {
	try {
		const appJwt = createGitHubAppJwt({ appId, privateKey });
		const resolvedInstallationId = installationId
			? installationId
			: repo
				? await getInstallationIdForRepo(repo, appJwt)
				: null;

		if (!resolvedInstallationId) {
			throw new Error("installationId or repo is required");
		}

		const tokenResponse = await githubApiRequest({
			url: `${GITHUB_API_BASE}/app/installations/${resolvedInstallationId}/access_tokens`,
			method: "POST",
			bearerToken: appJwt,
			body: {},
		});
		const tokenData = (await tokenResponse.json()) as {
			token?: string;
			expires_at?: string;
		};

		if (!tokenData.token) {
			throw new Error("GitHub App installation token was not returned");
		}

		return tokenData.token;
	} catch (error) {
		logger.error("Failed to create GitHub App installation token", {
			app_id: appId,
			repo,
			installation_id: installationId,
			error_message: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
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
	await githubApiRequest({
		url: `${GITHUB_API_BASE}/repos/${repo}/issues/${pr}/comments`,
		method: "POST",
		bearerToken: token,
		body: { body },
	});
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
