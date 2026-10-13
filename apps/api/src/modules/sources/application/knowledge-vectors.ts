import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { paginate } from "@ngriffin_uk/polychat-utility-server/arrays";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { getEmbeddingRuntimeForTarget } from "~/infrastructure/providers/capabilities/embedding/helpers";
import { decodeEmbeddingRuntimeTarget } from "~/infrastructure/providers/capabilities/embedding/target";
import {
  getPersonalEmbeddingScopeTag,
  getProjectEmbeddingScopeTag,
} from "~/infrastructure/providers/capabilities/embedding/utils/scope";
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

  if (stale.length === 0) {
    return;
  }

  for (const document of stale) {
    const token = generateId();

    if (!(await context.repositories.sourceSearch.claim(document.id, token, "stale"))) {
      continue;
    }

    const target = decodeEmbeddingRuntimeTarget(document.target);

    const user = await context.repositories.users.getUserById(document.user_id);

    if (!user) {
      continue;
    }

    const ownerContext = createServiceContext({ env: context.env, user });
    const settings = await ownerContext.getUserSettings();

    if (!settings) {
      continue;
    }

    const runtime = getEmbeddingRuntimeForTarget(context.env, user, settings, target);
    const chunks = await context.repositories.sourceSearch.chunks(document.id);

    for (const ids of paginate(
      chunks.map((chunk) => chunk.id),
      100,
    )) {
      const result = await runtime.vectorStore.delete(ids);

      if (result.status !== "success") {
        throw new AssistantError("Source vector cleanup failed", ErrorType.PROVIDER_ERROR, 502);
      }
    }

    await context.repositories.sourceSearch.removeStale(document.id, token);
  }
}

export async function insertSourceVectors(
  context: ServiceContext,
  source: SearchableSource,
  document: PendingEmbeddingDocument,
  target: EmbeddingRuntimeTarget,
  token: string,
  assertOwned: () => Promise<void>,
): Promise<void> {
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
  const scopeTag = source.project_id
    ? await getProjectEmbeddingScopeTag(context.env.EMBEDDING_SCOPE_SECRET, source.project_id)
    : await getPersonalEmbeddingScopeTag(
        context.env.EMBEDDING_SCOPE_SECRET,
        context.requireUser().id,
      );

  await assertOwned();
  await requireSourceAccess(context, context.requireUser().id, source.id);

  if (!(await context.repositories.sourceSearch.renew(document.documentId, token))) {
    return;
  }

  const vectors = await generateEmbeddingVectors(
    runtime.embedder,
    document.documentId,
    source.kind,
    document.chunks,
  );

  for (const batch of paginate(vectors, 100)) {
    await assertOwned();
    await requireSourceAccess(context, context.requireUser().id, source.id);
    if (!(await context.repositories.sourceSearch.renew(document.documentId, token))) {
      return;
    }

    const result = await runtime.vectorStore.insert(batch, { scopeTag, contentType: source.kind });

    if (result.status !== "success") {
      throw new AssistantError(
        "Source vectors could not be indexed",
        ErrorType.PROVIDER_ERROR,
        502,
      );
    }
  }

  await assertOwned();
  await requireSourceAccess(context, context.requireUser().id, source.id);
  await context.repositories.sourceSearch.activate(document.documentId, token);
}
