export type EmbeddingMetadata = Record<string, unknown>;

export type NumericEmbeddingVector = number[] | Float32Array | Float64Array;
export type NumericEmbeddingQuery = ReadonlyArray<number> | Float32Array | Float64Array;

export type EmbeddingDistanceMetric =
  | "cosine"
  | "dot-product"
  | "euclidean"
  | "provider-configured"
  | "unknown";
export type EmbeddingTaskMode = "symmetric" | "asymmetric" | "unknown";

/** The Phase 1 column shape. Keep this at repository boundaries until the schema migrates. */
export interface EmbeddingProviderTarget {
  provider: string;
  target: string;
  model: string;
  vectorSpace: string;
  vectorSpaceVersion: string;
}

/** Complete runtime identity used to decide whether vectors can share a search space. */
export interface EmbeddingRuntimeTarget {
  embeddingProvider: string;
  providerTarget: string;
  model: string;
  dimensions: number;
  distanceMetric: EmbeddingDistanceMetric;
  taskMode: EmbeddingTaskMode;
  vectorSpace: string;
  vectorSpaceVersion: string;
}

export type EmbeddingVector = {
  id: string;
  values: NumericEmbeddingVector;
  metadata: EmbeddingMetadata;
  content?: string;
};

export type EmbeddingMatch = {
  id: string;
  score: number;
  metadata: EmbeddingMetadata;
  title?: string;
  content?: string;
};

export type EmbeddingQueryResult = {
  matches: EmbeddingMatch[];
  count: number;
};

export type EmbeddingMutationResult = {
  status: string;
  error: string | null;
};

export interface EmbeddingScopeOptions {
  scopeTag?: string;
  contentType?: string;
  filter?: Record<string, unknown>;
}

export interface EmbeddingWriteOptions extends EmbeddingScopeOptions {}

export interface EmbeddingQueryOptions extends EmbeddingScopeOptions {
  topK?: number;
  returnValues?: boolean;
  returnMetadata?: "none" | "indexed" | "all";
}

export interface ManagedKnowledgeBaseQueryOptions extends EmbeddingScopeOptions {
  topK?: number;
  searchType?: string;
}

export interface EmbeddingQueryVectorResult {
  data: NumericEmbeddingVector[];
  status: { success: boolean };
}

export interface Embedder {
  generate(
    type: string,
    content: string,
    id: string,
    metadata: EmbeddingMetadata,
  ): Promise<EmbeddingVector[]>;

  getQuery(query: string): Promise<EmbeddingQueryVectorResult>;
}

export interface VectorStore {
  insert(
    embeddings: EmbeddingVector[],
    options?: EmbeddingWriteOptions,
  ): Promise<EmbeddingMutationResult>;

  delete(ids: string[]): Promise<EmbeddingMutationResult>;

  getMatches(
    queryVector: NumericEmbeddingQuery,
    options?: EmbeddingQueryOptions,
  ): Promise<EmbeddingQueryResult>;
}

export interface VectorEmbeddingRuntime extends Embedder, VectorStore {
  kind: "vector";
  embedder: Embedder;
  vectorStore: VectorStore;
}

export interface ResolvedEmbeddingRuntime {
  target: EmbeddingRuntimeTarget;
  runtime: VectorEmbeddingRuntime;
}

/**
 * Transitional contract for providers which still combine embedding, vector-store and
 * managed-knowledge-base operations. New retrieval code should depend on one of the
 * capability interfaces above.
 */
export interface EmbeddingProvider {
  generate(
    type: string,
    content: string,
    id: string,
    metadata: EmbeddingMetadata,
  ): Promise<EmbeddingVector[]>;

  insert(
    embeddings: EmbeddingVector[],
    options?: EmbeddingWriteOptions,
  ): Promise<EmbeddingMutationResult>;

  delete(ids: string[]): Promise<EmbeddingMutationResult>;

  getQuery(query: string): Promise<{ data: unknown; status: { success: boolean } }>;

  getMatches(query: any, options?: any): Promise<EmbeddingQueryResult>;
}
