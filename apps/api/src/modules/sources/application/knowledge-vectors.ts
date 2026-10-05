import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { paginate } from "@ngriffin_uk/polychat-utility-server/arrays";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getEmbeddingRuntimeForTarget } from "~/infrastructure/providers/capabilities/embedding/helpers";
import { decodeEmbeddingRuntimeTarget } from "~/infrastructure/providers/capabilities/embedding/target";
import { getProjectEmbeddingScopeTag } from "~/infrastructure/providers/capabilities/embedding/utils/scope";
import type { PendingEmbeddingDocument } from "~/modules/apps/application/embeddings/document";
import { generateEmbeddingVectors } from "~/modules/apps/application/embeddings/lifecycle";
import type { SearchableSource } from "~/modules/sources/infrastructure/SourceSearchRepository";
import type { EmbeddingRuntimeTarget } from "~/types";

import { requireSourceAccess } from "./sources";

export async function cleanupStaleIndexes(
  context: Pick<ServiceContext, "env" | "repositories">,
  sourceId: string,
): Promise<void> {
  const stale = await context.repositories.sourceSearch.stale(sourceId);

  if (stale.length === 0 || !context.env.VECTOR_DB) {
    return;
  }

  for (const document of stale) {
    const token = generateId();

    if (!(await context.repositories.sourceSearch.claim(document.id, token, "stale"))) {
      continue;
    }

    try {
      const target = decodeEmbeddingRuntimeTarget(document.target);

      if (
        target.embeddingProvider !== "vectorize" ||
        target.providerTarget !== "vectorize-binding"
      ) {
        throw new AssistantError(
          "Project knowledge cleanup has an unsupported target",
          ErrorType.CONFIGURATION_ERROR,
          409,
        );
      }

      const chunks = await context.repositories.sourceSearch.chunks(document.id);

      for (const ids of paginate(
        chunks.map((chunk) => chunk.id),
        500,
      )) {
        await context.env.VECTOR_DB.deleteByIds(ids);
      }

      await context.repositories.sourceSearch.removeStale(document.id, token);
    } finally {
      await context.repositories.sourceSearch.release(document.id, token);
    }
  }
}

export async function insertSourceVectors(
  context: ServiceContext,
  source: SearchableSource,
  document: PendingEmbeddingDocument,
  target: EmbeddingRuntimeTarget,
  token: string,
): Promise<void> {
  if (!source.project_id) {
    return;
  }

  const settings = await context.getUserSettings();

  if (!settings) {
    throw new AssistantError("User settings not found", ErrorType.NOT_FOUND, 404);
  }

  const runtime = getEmbeddingRuntimeForTarget(
    context.env,
    context.requireUser(),
    settings,
    target,
  );
  const scopeTag = await getProjectEmbeddingScopeTag(
    context.env.EMBEDDING_SCOPE_SECRET,
    source.project_id,
  );
  const vectors = await generateEmbeddingVectors(
    runtime.embedder,
    document.documentId,
    source.kind,
    document.chunks,
  );

  await requireSourceAccess(context, context.requireUser().id, source.id);
  if (!(await context.repositories.sourceSearch.renew(document.documentId, token))) {
    return;
  }

  const result = await runtime.vectorStore.insert(vectors, { scopeTag });

  if (result.status !== "success") {
    throw new AssistantError("Source vectors could not be indexed", ErrorType.PROVIDER_ERROR, 502);
  }

  await context.repositories.sourceSearch.activate(document.documentId, token);
}
