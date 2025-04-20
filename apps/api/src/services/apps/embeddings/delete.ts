import { Database } from "~/lib/database";
import { Embedding } from "~/lib/embedding";
import type { IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "DELETE_EMBEDDING" });

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

    const database = Database.getInstance(env);
    const userSettings = await database.getUserSettings(req.user?.id);
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
