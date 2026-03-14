import { githubApiRequest } from "./api-client";
import { createGitHubAppJwt } from "./app-jwt";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/github/installation-token" });
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

export async function getGitHubAppInstallationToken(params: {
	appId: string;
	privateKey: string;
	repo?: string;
	installationId?: number;
}): Promise<string> {
	const { appId, privateKey, repo, installationId } = params;

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
