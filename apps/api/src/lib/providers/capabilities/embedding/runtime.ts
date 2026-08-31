import type {
  Embedder,
  EmbeddingProvider,
  EmbeddingQueryOptions,
  EmbeddingQueryVectorResult,
  EmbeddingVector,
  EmbeddingWriteOptions,
  NumericEmbeddingQuery,
  NumericEmbeddingVector,
  VectorEmbeddingRuntime,
  VectorStore,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

const isNumericEmbeddingVector = (value: unknown): value is NumericEmbeddingVector => {
  const values =
    Array.isArray(value) || value instanceof Float32Array || value instanceof Float64Array
      ? Array.from(value)
      : null;

  return (
    !!values?.length && values.every((item) => typeof item === "number" && Number.isFinite(item))
  );
};

const parseQueryVectorResult = (value: {
  data: unknown;
  status: { success: boolean };
}): EmbeddingQueryVectorResult => {
  const data = Array.isArray(value.data) ? value.data : null;

  if (!value.status.success || !data?.length || !data.every(isNumericEmbeddingVector)) {
    throw new AssistantError(
      "Embedding provider returned an invalid query vector",
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  return { data, status: value.status };
};

export const adaptVectorEmbeddingProvider = (
  provider: EmbeddingProvider,
): VectorEmbeddingRuntime => {
  const embedder: Embedder = {
    generate: (type, content, id, metadata) => provider.generate(type, content, id, metadata),
    getQuery: async (query) => parseQueryVectorResult(await provider.getQuery(query)),
  };
  const vectorStore: VectorStore = {
    insert: (embeddings: EmbeddingVector[], options: EmbeddingWriteOptions = {}) =>
      provider.insert(embeddings, options),
    delete: (ids) => provider.delete(ids),
    getMatches: (queryVector: NumericEmbeddingQuery, options: EmbeddingQueryOptions = {}) =>
      provider.getMatches(queryVector, options),
  };

  return {
    kind: "vector",
    embedder,
    vectorStore,
    generate: (type, content, id, metadata) => embedder.generate(type, content, id, metadata),
    getQuery: (query) => embedder.getQuery(query),
    insert: (embeddings, options) => vectorStore.insert(embeddings, options),
    delete: (ids) => vectorStore.delete(ids),
    getMatches: (queryVector, options) => vectorStore.getMatches(queryVector, options),
  };
};
