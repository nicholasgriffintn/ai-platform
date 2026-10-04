import { SOURCE_KNOWLEDGE_INDEX_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { EMBEDDING_VECTOR_SPACE_VERSION, WORKERS_EMBEDDING_MODEL } from "~/config/storage";
import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import {
  decodeEmbeddingRuntimeTarget,
  toEmbeddingRuntimeTarget,
} from "~/infrastructure/providers/capabilities/embedding/target";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { IEnv } from "~/types";

import { prepareSourceSearchDocument } from "./knowledge-document";
import { cleanupStaleIndexes, insertSourceVectors } from "./knowledge-vectors";
import { requireSourceAccess } from "./sources";

export const projectKnowledgeTarget = () =>
  toEmbeddingRuntimeTarget({
    provider: "vectorize",
    target: "vectorize-binding",
    model: WORKERS_EMBEDDING_MODEL,
    vectorSpace: "default",
    vectorSpaceVersion: EMBEDDING_VECTOR_SPACE_VERSION,
  });

export async function indexProjectSource(context: ServiceContext, sourceId: string): Promise<void> {
  await cleanupStaleIndexes(context, sourceId);
  const source = await context.repositories.sourceSearch.getSource(sourceId);

  if (
    !source?.project_id ||
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
    : projectKnowledgeTarget();

  await context.repositories.sourceSearch.prepare(source, document, target);
  if (!context.env.AI || !context.env.VECTOR_DB) {
    return;
  }

  const token = generateId();

  if (!(await context.repositories.sourceSearch.claim(document.documentId, token, "lexical"))) {
    return;
  }

  try {
    await insertSourceVectors(context, source, document, target, token);
  } finally {
    await context.repositories.sourceSearch.release(document.documentId, token);
  }
}

export async function scheduleKnowledgeIndexes(env: IEnv): Promise<number> {
  const repositories = RepositoryManager.getInstance(env);
  const sources = await repositories.sourceSearch.maintenance(
    Boolean(env.AI && env.VECTOR_DB),
    Boolean(env.VECTOR_DB),
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
): Promise<void> {
  const repositories = RepositoryManager.getInstance(env);
  const user = userId ? await repositories.users.getUserById(userId) : null;

  if (!user) {
    await cleanupStaleIndexes({ env, repositories }, sourceId);

    return;
  }

  await indexProjectSource(createServiceContext({ env, user }), sourceId);
}
