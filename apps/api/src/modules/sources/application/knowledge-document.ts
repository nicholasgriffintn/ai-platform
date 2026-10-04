import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { chunkText } from "@ngriffin_uk/polychat-utility-server/embeddings";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { PendingEmbeddingDocument } from "~/modules/apps/application/embeddings/document";
import type { SearchableSource } from "~/modules/sources/infrastructure/SourceSearchRepository";

export async function prepareSourceSearchDocument(
  source: SearchableSource,
): Promise<PendingEmbeddingDocument> {
  const digest = await sha256Hex(`${source.id}:${source.search_revision}`);
  const chunks = chunkText(source.content ?? "", 2048);

  if (chunks.length > 256) {
    throw new AssistantError(
      "Source exceeds the knowledge index size limit",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return {
    documentId: `srcidx_${digest.slice(0, 56)}`,
    logicalId: source.id,
    content: source.content ?? "",
    title: source.title,
    chunks: chunks.map((content, index) => ({
      id: `srcv_${digest.slice(0, 50)}_${index}`,
      vectorId: `srcv_${digest.slice(0, 50)}_${index}`,
      index,
      content,
    })),
  };
}
