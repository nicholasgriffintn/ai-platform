import type { EmbeddingProvider, EmbeddingQueryResult } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export const queryEmbeddingProvider = async ({
  provider,
  query,
  type,
  scopeTag,
}: {
  provider: EmbeddingProvider;
  query: string;
  type?: string;
  scopeTag: string;
}): Promise<EmbeddingQueryResult> => {
  try {
    const queryVector = await provider.getQuery(query);

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

    return await provider.getMatches(providerQuery, {
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
