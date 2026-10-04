import { SOURCE_INDEX_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";
import { chunkArray } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  decodeEmbeddingRuntimeTarget,
  encodeEmbeddingRuntimeTarget,
  getEmbeddingRuntimeForTarget,
  resolveEmbeddingRuntime,
} from "~/infrastructure/providers/capabilities/embedding/helpers";
import {
  getPersonalEmbeddingScopeTag,
  getProjectEmbeddingScopeTag,
} from "~/infrastructure/providers/capabilities/embedding/utils/scope";
import { prepareEmbeddingDocument } from "~/modules/apps/application/embeddings/document";
import { generateEmbeddingVectors } from "~/modules/apps/application/embeddings/lifecycle";
import {
  SourceIndexRepository,
  type SourceIndexRecord,
} from "~/modules/sources/infrastructure/SourceIndexRepository";
import { TaskService } from "~/modules/tasks/application/TaskService";

import { extractKnowledgeSource } from "./knowledge-extraction";
import { requireSourceAccess } from "./sources";

export async function removeSourceIndex(
  context: ServiceContext,
  index: SourceIndexRecord,
): Promise<void> {
  const settings = await context.getUserSettings();

  if (!settings || context.requireUser().id !== index.created_by_user_id) {
    throw new AssistantError("Index credentials unavailable", ErrorType.CONFIGURATION_ERROR, 409);
  }

  const runtime = getEmbeddingRuntimeForTarget(
    context.env,
    context.requireUser(),
    settings,
    decodeEmbeddingRuntimeTarget(index.target),
  );
  const repository = new SourceIndexRepository(context.env);

  for (const ids of chunkArray(await repository.getVectorIds(index.id), 100)) {
    const result = await runtime.vectorStore.delete(ids);

    if (result.status !== "success") {
      throw new AssistantError("Index cleanup failed", ErrorType.PROVIDER_ERROR, 502);
    }
  }

  await repository.remove(index.id);
}

export async function indexSource(
  context: ServiceContext,
  sourceId: string,
  expectedRevision: number,
  assertOwned: () => Promise<void>,
): Promise<void> {
  await assertOwned();
  const user = context.requireUser();

  await requireSourceAccess(context, user.id, sourceId);
  const repository = new SourceIndexRepository(context.env);

  if ((await repository.getSourceRevision(sourceId)) !== expectedRevision) {
    return;
  }

  await extractKnowledgeSource(context, sourceId);
  const source = await repository.getSnapshot(sourceId);

  if (source && source.knowledge_revision !== expectedRevision) {
    await enqueueSourceIndex(context, sourceId);

    return;
  }

  if (
    !source ||
    source.status !== "available" ||
    source.kind === "memory" ||
    !source.content?.trim()
  ) {
    return;
  }

  const revision = source.knowledge_revision;

  const existing = await repository.getCurrentIndex(sourceId, revision);

  if (existing?.lifecycle_status === "active") {
    return;
  }

  const settings = await context.getUserSettings();

  if (!settings) {
    throw new AssistantError("User settings unavailable", ErrorType.NOT_FOUND, 404);
  }

  const resolved = existing
    ? {
        runtime: getEmbeddingRuntimeForTarget(
          context.env,
          user,
          settings,
          decodeEmbeddingRuntimeTarget(existing.target),
        ),
        target: decodeEmbeddingRuntimeTarget(existing.target),
      }
    : await resolveEmbeddingRuntime(context.env, user, settings);
  const { runtime, target } = resolved;
  const prepared = prepareEmbeddingDocument({
    id: sourceId,
    type: source.kind,
    content: source.content,
    title: source.title,
  });
  const document = existing
    ? { ...prepared, documentId: existing.id, chunks: await repository.getChunks(existing.id) }
    : prepared;
  const scopeTag = source.project_id
    ? await getProjectEmbeddingScopeTag(context.env.EMBEDDING_SCOPE_SECRET, source.project_id)
    : await getPersonalEmbeddingScopeTag(context.env.EMBEDDING_SCOPE_SECRET, user.id);

  await assertOwned();
  if (existing) {
    await repository.resume(existing.id);
  } else {
    await repository.prepare({
      id: document.documentId,
      sourceId,
      revision,
      userId: user.id,
      target: encodeEmbeddingRuntimeTarget(target),
      title: document.title,
      chunks: document.chunks,
    });
  }

  try {
    await assertOwned();
    await requireSourceAccess(context, user.id, sourceId);
    if ((await repository.getSourceRevision(sourceId)) !== revision) {
      return;
    }

    const vectors = await generateEmbeddingVectors(
      runtime.embedder,
      document.documentId,
      source.kind,
      document.chunks,
    );

    for (const batch of chunkArray(vectors, 100)) {
      await assertOwned();
      await requireSourceAccess(context, user.id, sourceId);
      if ((await repository.getSourceRevision(sourceId)) !== revision) {
        return;
      }

      const result = await runtime.vectorStore.insert(batch, {
        scopeTag,
        contentType: source.kind,
      });

      if (result.status !== "success") {
        throw new AssistantError("Source indexing failed", ErrorType.PROVIDER_ERROR, 502);
      }
    }

    await assertOwned();
    await requireSourceAccess(context, user.id, sourceId);
    if (!(await repository.activate(document.documentId))) {
      throw new AssistantError(
        "Source changed before index activation",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }
  } catch (error) {
    await repository.fail(document.documentId);
    throw error;
  }
}

export async function enqueueSourceIndex(context: ServiceContext, sourceId: string): Promise<void> {
  const source = await requireSourceAccess(context, context.requireUser().id, sourceId);
  const revision = await new SourceIndexRepository(context.env).getSourceRevision(sourceId);

  if (
    revision === null ||
    source.status !== "available" ||
    source.kind === "memory" ||
    (!source.content?.trim() && source.kind !== "file")
  ) {
    return;
  }

  await new TaskService(context.env, context.repositories.tasks).enqueueTask({
    id: `source_index_${sourceId}_${revision}`,
    task_type: SOURCE_INDEX_TASK_TYPE,
    user_id: source.created_by_user_id,
    project_id: source.project_id ?? undefined,
    task_data: { sourceId, revision },
  });
}

export async function retrySourceIndex(
  context: ServiceContext,
  sourceId: string,
): Promise<{ queued: true }> {
  await requireSourceAccess(context, context.requireUser().id, sourceId, true);
  await new SourceIndexRepository(context.env).invalidate(sourceId);
  await enqueueSourceIndex(context, sourceId);

  return { queued: true };
}
