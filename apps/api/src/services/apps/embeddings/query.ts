import { RepositoryManager } from "~/repositories";
import {
	getEmbeddingProvider,
	getEmbeddingNamespace,
} from "~/lib/providers/capabilities/embedding/helpers";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/apps/embeddings/query" });

export const queryEmbeddings = async (req: any): Promise<any> => {
	try {
		const { request, env } = req;

		const { query, namespace } = request.query;

		if (!query) {
			throw new AssistantError(
				"Missing query from request",
				ErrorType.PARAMS_ERROR,
			);
		}

		const repositories = new RepositoryManager(env);
		const userSettings = req.user?.id
			? await repositories.userSettings.getUserSettings(req.user.id)
			: null;
		if (!userSettings) {
			throw new AssistantError("User settings not found", ErrorType.NOT_FOUND);
		}
		const embedding = getEmbeddingProvider(env, req.user, userSettings);

		const finalNamespace = getEmbeddingNamespace(req.user, {
			namespace,
		});

		let matchesWithContent = [];
		try {
			matchesWithContent = await embedding.searchSimilar(query, {
				namespace: finalNamespace,
			});
		} catch (searchError: unknown) {
			if (
				searchError instanceof AssistantError &&
				searchError.type === ErrorType.NOT_FOUND
			) {
				logger.info("No matches found for query", {
					query,
					namespace: finalNamespace,
				});
			} else {
				throw searchError;
			}
		}

		return {
			status: "success",
			data: matchesWithContent,
		};
	} catch (error) {
		logger.error("Error querying embeddings", {
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			errorObject: error,
		});

		throw new AssistantError("Error querying embeddings");
	}
};
