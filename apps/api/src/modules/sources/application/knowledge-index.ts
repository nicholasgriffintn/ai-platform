import { SOURCE_KNOWLEDGE_INDEX_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";
import { generateId, sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { chunkText } from "@ngriffin_uk/polychat-utility-server/embeddings";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { EMBEDDING_VECTOR_SPACE_VERSION, WORKERS_EMBEDDING_MODEL } from "~/config/storage";
import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import {
  decodeEmbeddingRuntimeTarget,
  toEmbeddingRuntimeTarget,
} from "~/infrastructure/providers/capabilities/embedding/target";
import type { PendingEmbeddingDocument } from "~/modules/apps/application/embeddings/document";
import type { SearchableSource } from "~/modules/sources/infrastructure/SourceSearchRepository";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { IEnv } from "~/types";

import { cleanupStaleIndexes, insertSourceVectors } from "./knowledge-vectors";
import { requireSourceAccess } from "./sources";

async function prepareSourceSearchDocument(
  source: SearchableSource,
): Promise<PendingEmbeddingDocument> {
  const digest = await sha256Hex(`${source.id}:${source.search_revision}`);
  const content = source.content ?? "";
  const chunks = chunkText(content, 2048);

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
    content,
    title: source.title,
    chunks: chunks.map((content, index) => ({
      id: `srcv_${digest.slice(0, 50)}_${index}`,
      vectorId: `srcv_${digest.slice(0, 50)}_${index}`,
      index,
      content,
    })),
  };
}

export async function indexProjectSource(
  context: ServiceContext,
  sourceId: string,
  assertOwned: () => Promise<void>,
): Promise<void> {
  await assertOwned();
  await cleanupStaleIndexes(context, sourceId);
  const source = await context.repositories.sourceSearch.getSource(sourceId);

  if (
    !source ||
    source.kind === "memory" ||
    source.status !== "available" ||
    !source.content?.trim()
  ) {
    return;
  }

  await requireSourceAccess(context, context.requireUser().id, source.id);
  const existing = await context.repositories.sourceSearch.getDocument(
    source.id,
    source.search_revision,
  );

  if (existing?.status === "active") {
    return;
  }

  const document = await prepareSourceSearchDocument(source);
  const target = existing
    ? decodeEmbeddingRuntimeTarget(existing.target)
    : toEmbeddingRuntimeTarget({
        provider: "vectorize",
        target: "vectorize-binding",
        model: WORKERS_EMBEDDING_MODEL,
        vectorSpace: "default",
        vectorSpaceVersion: EMBEDDING_VECTOR_SPACE_VERSION,
      });

  await context.repositories.sourceSearch.prepare(
    source,
    document,
    target,
    context.requireUser().id,
  );
  if (!context.env.AI || !context.env.VECTOR_DB) {
    return;
  }

  const token = generateId();

  if (!(await context.repositories.sourceSearch.claim(document.documentId, token, "lexical"))) {
    return;
  }

  try {
    await assertOwned();
    await insertSourceVectors(context, source, document, target, token, assertOwned);
  } finally {
    await context.repositories.sourceSearch.release(document.documentId, token);
  }
}

export async function scheduleKnowledgeIndexes(env: IEnv): Promise<number> {
  const repositories = RepositoryManager.getInstance(env);
  const sources = await repositories.sourceSearch.maintenance(
    Boolean(env.AI && env.VECTOR_DB),
    true,
  );
  const tasks = new TaskService(env, repositories.tasks);

  for (const source of sources) {
    await tasks.enqueueTask({
      task_type: SOURCE_KNOWLEDGE_INDEX_TASK_TYPE,
      user_id: source.user_id ?? undefined,
      project_id: source.project_id ?? undefined,
      task_data: { sourceId: source.id },
    });
  }

  return sources.length;
}

export async function indexSourceForUser(
  env: IEnv,
  userId: number | undefined,
  sourceId: string,
  assertOwned: () => Promise<void>,
): Promise<void> {
  const repositories = RepositoryManager.getInstance(env);
  const user = userId ? await repositories.users.getUserById(userId) : null;

  if (!user) {
    await cleanupStaleIndexes({ env, repositories }, sourceId);

    return;
  }

  await indexProjectSource(createServiceContext({ env, user }), sourceId, assertOwned);
}
