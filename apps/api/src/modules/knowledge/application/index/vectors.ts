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
import { generateEmbeddingVectors } from "~/modules/knowledge/application/index/chunks";
import {
  KnowledgeIndexRepository,
  type IndexableResource,
  type IndexedResourceType,
} from "~/modules/knowledge/infrastructure/KnowledgeIndexRepository";
import { requireMemoryDocumentAccess } from "~/modules/memory-documents/application/memory-documents";
import { requireOutputAccess } from "~/modules/outputs/application/access";
import { requireSourceAccess } from "~/modules/sources/application/sources";
import { getRequestUserSettings } from "~/modules/user/application/request-settings";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import type { EmbeddingRuntimeTarget } from "~/types";

const VECTOR_BATCH = 100;

export async function cleanupStaleIndexes(
  context: Pick<ServiceContext, "env" | "repositories">,
  resourceType: IndexedResourceType,
  resourceId: string,
): Promise<void> {
  const index = context.repositories.get(KnowledgeIndexRepository);
  const stale = await index.stale(resourceType, resourceId);

  for (const document of stale) {
    const token = generateId();

    if (!(await index.claim(document.id, token, "stale"))) {
      continue;
    }

    const target = decodeEmbeddingRuntimeTarget(document.target);
    const user = await context.repositories.get(UserRepository).getUserById(document.user_id);

    if (!user) {
      continue;
    }

    const settings = await getRequestUserSettings(createServiceContext({ env: context.env, user }));

    if (!settings) {
      continue;
    }

    const runtime = getEmbeddingRuntimeForTarget(context.env, user, settings, target);
    const chunks = await index.chunks(document.id);

    for (const ids of paginate(
      chunks.map((chunk) => chunk.id),
      VECTOR_BATCH,
    )) {
      const result = await runtime.vectorStore.delete(ids);

      if (result.status !== "success") {
        throw new AssistantError("Knowledge vector cleanup failed", ErrorType.PROVIDER_ERROR, 502);
      }
    }

    await index.removeStale(document.id, token);
  }
}

async function requireResourceAccess(
  context: ServiceContext,
  resource: IndexableResource,
): Promise<void> {
  const userId = context.requireUser().id;

  if (resource.resource_type === "memory") {
    await requireMemoryDocumentAccess(context, resource.id);

    return;
  }

  await (resource.resource_type === "source"
    ? requireSourceAccess(context, userId, resource.id)
    : requireOutputAccess(context, userId, resource.id));
}

export async function insertResourceVectors(
  context: ServiceContext,
  resource: IndexableResource,
  documentId: string,
  target: EmbeddingRuntimeTarget,
  token: string,
  assertOwned: () => Promise<void>,
): Promise<void> {
  const settings = await getRequestUserSettings(context);

  if (!settings) {
    throw new AssistantError("User settings not found", ErrorType.NOT_FOUND, 404);
  }

  const runtime = getEmbeddingRuntimeForTarget(
    context.env,
    context.requireUser(),
    settings,
    target,
  );
  const scopeTag = resource.project_id
    ? await getProjectEmbeddingScopeTag(context.env.EMBEDDING_SCOPE_SECRET, resource.project_id)
    : await getPersonalEmbeddingScopeTag(
        context.env.EMBEDDING_SCOPE_SECRET,
        context.requireUser().id,
      );
  const index = context.repositories.get(KnowledgeIndexRepository);
  const pending = await index.pendingChunks(documentId);

  for (const batch of paginate(pending, VECTOR_BATCH)) {
    await assertOwned();
    await requireResourceAccess(context, resource);

    if (!(await index.renew(documentId, token))) {
      return;
    }

    const vectors = await generateEmbeddingVectors(
      runtime.embedder,
      documentId,
      resource.kind,
      batch.map((chunk) => ({
        id: chunk.id,
        vectorId: chunk.id,
        index: chunk.chunk_index,
        content: chunk.content,
      })),
    );
    const result = await runtime.vectorStore.insert(vectors, {
      scopeTag,
      contentType: resource.kind,
    });

    if (result.status !== "success") {
      throw new AssistantError(
        "Knowledge vectors could not be indexed",
        ErrorType.PROVIDER_ERROR,
        502,
      );
    }

    await index.markChunksEmbedded(
      documentId,
      batch.map((chunk) => chunk.id),
    );
  }

  await assertOwned();
  await requireResourceAccess(context, resource);
  await index.activate(documentId, token);
}
