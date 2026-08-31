import type { InsertEmbeddingInput } from "@ngriffin_uk/polychat-schemas";

import { chunkText } from "~/utils/embeddings";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generatePrefixedId } from "~/utils/id";
import { sanitiseInput } from "~/utils/sanitise";

const MAX_CHUNKS = 128;
const CHUNK_SIZE = 2048;

export type PendingEmbeddingChunk = {
  id: string;
  vectorId: string;
  index: number;
  content: string;
};

export type PendingEmbeddingDocument = {
  documentId: string;
  logicalId: string;
  content: string;
  title: string;
  chunks: PendingEmbeddingChunk[];
};

export const prepareEmbeddingDocument = (input: InsertEmbeddingInput): PendingEmbeddingDocument => {
  const content = sanitiseInput(input.content);
  const title = input.title ? sanitiseInput(input.title) : "";

  if (!content) {
    throw new AssistantError("Embedding content must not be empty", ErrorType.PARAMS_ERROR, 400);
  }

  const contentChunks = content.length <= CHUNK_SIZE ? [content] : chunkText(content, CHUNK_SIZE);

  if (contentChunks.length === 0 || contentChunks.length > MAX_CHUNKS) {
    throw new AssistantError(
      `Embedding content must produce between 1 and ${MAX_CHUNKS} chunks`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return {
    documentId: generatePrefixedId("embdoc_"),
    logicalId: input.id ?? generatePrefixedId("doc_"),
    content,
    title,
    chunks: contentChunks.map((chunk, index) => ({
      id: generatePrefixedId("embchk_"),
      vectorId: generatePrefixedId("emb_"),
      index,
      content: chunk,
    })),
  };
};
