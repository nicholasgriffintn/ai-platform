import { getServiceContext } from "~/lib/context/serviceContext";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/github" });

export async function getGithubConnectionToken(
	userId: number,
	ctx: ReturnType<typeof getServiceContext>,
) {
	const providerIds = ["github-models", "github-copilot", "github"];

	for (const providerId of providerIds) {
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
	}

	return null;
}
