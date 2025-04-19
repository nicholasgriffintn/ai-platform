import { Database } from "../../../lib/database";
import { Embedding } from "../../../lib/embedding";
import { AssistantError, ErrorType } from "../../../utils/errors";
import { getLogger } from "../../../utils/logger";

const logger = getLogger({ prefix: "QUERY_EMBEDDINGS" });

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

    const database = Database.getInstance(env);
    const userSettings = await database.getUserSettings(req.user?.id);
    const embedding = Embedding.getInstance(env, req.user, userSettings);

    const matchesWithContent = await embedding.searchSimilar(query, {
      namespace,
    });

    return {
      status: "success",
      data: matchesWithContent,
    };
  } catch (error) {
    logger.error("Error querying embeddings", { error });
    throw new AssistantError("Error querying embeddings");
  }
};
