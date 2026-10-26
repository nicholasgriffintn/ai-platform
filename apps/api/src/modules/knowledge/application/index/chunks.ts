import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { Embedder, EmbeddingVector } from "~/types";

const EMBEDDING_GENERATION_CONCURRENCY = 8;

export interface PendingEmbeddingChunk {
  id: string;
  vectorId: string;
  index: number;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface PendingEmbeddingDocument {
  documentId: string;
  logicalId: string;
  content: string;
  title: string;
  chunks: PendingEmbeddingChunk[];
}

export const generateEmbeddingVectors = async (
  embedder: Embedder,
  documentId: string,
  type: string,
  chunks: PendingEmbeddingChunk[],
): Promise<EmbeddingVector[]> =>
  mapWithConcurrency(chunks, EMBEDDING_GENERATION_CONCURRENCY, async (chunk) => {
    const trustedMetadata = {
      documentId,
      chunkId: chunk.id,
      chunkIndex: chunk.index,
      type,
    };
    const vectors = await embedder.generate(type, chunk.content, chunk.vectorId, trustedMetadata);

    if (vectors.length !== 1 || !vectors[0]?.values) {
      throw new AssistantError(
        "Embedding provider returned an invalid vector",
        ErrorType.PROVIDER_ERROR,
        502,
      );
    }

    return {
      id: chunk.vectorId,
      values: vectors[0].values,
      metadata: trustedMetadata,
      content: chunk.content,
    };
  });
