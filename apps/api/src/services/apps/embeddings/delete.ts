import { RepositoryManager } from "~/repositories";
import { Embedding } from "~/lib/embedding";
import type { IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/apps/embeddings/delete" });

// @ts-ignore
export interface IDeleteEmbeddingRequest extends IRequest {
	request: {
		ids: string[];
	};
}

export const deleteEmbedding = async (
	req: IDeleteEmbeddingRequest,
): Promise<any> => {
	try {
		const { request, env } = req;

		const { ids } = request;

		if (!ids) {
			throw new AssistantError(
				"Missing ids from request",
				ErrorType.PARAMS_ERROR,
			);
		}

		const repositories = new RepositoryManager(env);
		const userSettings = await repositories.userSettings.getUserSettings(req.user?.id);
		if (!userSettings) {
			throw new AssistantError("User settings not found", ErrorType.NOT_FOUND);
		}
		const embedding = Embedding.getInstance(env, req.user, userSettings);

		const result = await embedding.delete(ids);

		if (result.status !== "success") {
			throw new AssistantError("Error deleting embedding");
		}

		return {
			status: "success",
			data: {
				ids,
			},
		};
	} catch (error) {
		logger.error("Error deleting embedding", { error });
		throw new AssistantError("Error deleting embedding");
	}
};
