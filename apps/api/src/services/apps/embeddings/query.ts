import { Embedding } from "../../../lib/embedding";
import { AssistantError, ErrorType } from "../../../utils/errors";

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

    const embedding = Embedding.getInstance(env);

    const matchesWithContent = await embedding.searchSimilar(query, {
      namespace,
    });

    return {
      status: "success",
      data: matchesWithContent,
    };
  } catch (error) {
    console.error("Error querying embeddings", error);
    throw new AssistantError("Error querying embeddings");
  }
};
