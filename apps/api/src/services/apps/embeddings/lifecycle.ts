import type { ServiceContext } from "~/lib/context/serviceContext";
import type { EmbeddingProvider, EmbeddingVector } from "~/types";
import { mapWithConcurrency } from "~/utils/async";
import { AssistantError, ErrorType } from "~/utils/errors";

import type { PendingEmbeddingChunk } from "./document";

const EMBEDDING_GENERATION_CONCURRENCY = 8;

export const generateEmbeddingVectors = async (
  provider: EmbeddingProvider,
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
    const vectors = await provider.generate(type, chunk.content, chunk.vectorId, trustedMetadata);

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

const removeInsertedVectors = async (
  provider: EmbeddingProvider,
  vectorIds: string[],
): Promise<boolean> => {
  if (vectorIds.length === 0) {
    return true;
  }

  try {
    const result = await provider.delete(vectorIds);

    return result.status === "success";
  } catch {
    // The inactive D1 document prevents an orphaned provider vector from becoming queryable.
    return false;
  }
};

export const cleanupPendingEmbeddingDocument = async ({
  context,
  provider,
  providerWriteAttempted,
  userId,
  documentId,
  vectorIds,
}: {
  context: ServiceContext;
  provider: EmbeddingProvider;
  providerWriteAttempted: boolean;
  userId: number;
  documentId: string;
  vectorIds: string[];
}): Promise<void> => {
  if (providerWriteAttempted && !(await removeInsertedVectors(provider, vectorIds))) {
    return;
  }

  try {
    await context.repositories.embeddings.removePendingDocument(userId, documentId);
  } catch {
    context
      .getLogger({ prefix: "services/apps/embeddings/insert" })
      .warn("Failed to remove an inactive embedding document", { documentId });
  }
};
