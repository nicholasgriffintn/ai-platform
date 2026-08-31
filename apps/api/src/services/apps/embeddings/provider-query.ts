import type { Embedder, EmbeddingQueryResult, VectorStore } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export const queryEmbeddingRuntime = async ({
  embedder,
  vectorStore,
  query,
  type,
  scopeTag,
}: {
  embedder: Embedder;
  vectorStore: VectorStore;
  query: string;
  type?: string;
  scopeTag: string;
}): Promise<EmbeddingQueryResult> => {
  try {
    const queryVector = await embedder.getQuery(query);

    if (
      !queryVector.status.success ||
      queryVector.data === undefined ||
      queryVector.data === null
    ) {
      throw new AssistantError(
        "Embedding provider could not encode the query",
        ErrorType.PROVIDER_ERROR,
        502,
      );
    }

    const providerQuery = Array.isArray(queryVector.data) ? queryVector.data[0] : queryVector.data;

    return await vectorStore.getMatches(providerQuery, {
      scopeTag,
      contentType: type,
      topK: 15,
      returnMetadata: "none",
    });
  } catch {
    throw new AssistantError(
      "Embedding provider could not search the vector index",
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }
};
