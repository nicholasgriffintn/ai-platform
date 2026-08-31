export type EmbeddingInsertRecord = {
  id: string;
  metadata: Record<string, unknown>;
  title: string;
  content: string;
  type: string;
};

export type CreateEmbeddingDocument = {
  id: string;
  logicalId: string;
  userId: number;
  type: string;
  title: string;
  metadata: Record<string, unknown>;
  provider: string;
  providerTarget: string;
  embeddingModel: string;
  vectorSpace: string;
  vectorSpaceVersion: string;
  chunks: {
    id: string;
    vectorId: string;
    index: number;
    content: string;
    metadata?: Record<string, unknown>;
  }[];
};

export type ActiveEmbeddingChunk = {
  vectorId: string;
  logicalId: string;
  title: string;
  content: string;
  type: string;
  metadata: Record<string, unknown>;
  provider: string;
  providerTarget: string;
  embeddingModel: string;
  vectorSpace: string;
  vectorSpaceVersion: string;
};

export type EmbeddingDocumentDeletionTarget = {
  id: string;
  logicalId: string;
  provider: string;
  providerTarget: string;
  embeddingModel: string;
  vectorSpace: string;
  vectorSpaceVersion: string;
  vectorIds: string[];
};

export type EmbeddingDocumentProviderTarget = Omit<
  EmbeddingDocumentDeletionTarget,
  "id" | "logicalId" | "vectorIds"
>;

export type EmbeddingScope = {
  namespace: string;
  userId: number | string;
};

export type EmbeddingLookupOptions = EmbeddingScope & {
  type?: string;
};

export type EmbeddingDeletionRow = {
  id: string;
  logical_id: string;
  provider: string;
  provider_target: string;
  embedding_model: string;
  vector_space: string;
  vector_space_version: string;
  vector_id: string | null;
};

export const collectEmbeddingDeletionTargets = (
  rows: EmbeddingDeletionRow[],
): EmbeddingDocumentDeletionTarget[] => {
  const documents = new Map<string, EmbeddingDocumentDeletionTarget>();

  for (const row of rows) {
    const document = documents.get(row.id) ?? {
      id: row.id,
      logicalId: row.logical_id,
      provider: row.provider,
      providerTarget: row.provider_target,
      embeddingModel: row.embedding_model,
      vectorSpace: row.vector_space,
      vectorSpaceVersion: row.vector_space_version,
      vectorIds: [],
    };

    if (row.vector_id) {
      document.vectorIds.push(row.vector_id);
    }

    documents.set(row.id, document);
  }

  return [...documents.values()];
};
