import { SOURCE_KNOWLEDGE_INDEX_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";
import { generateId, sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { chunkKnowledgeText } from "@ngriffin_uk/polychat-utility-server/embeddings";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import { EMBEDDING_VECTOR_SPACE_VERSION, WORKERS_EMBEDDING_MODEL } from "~/config/storage";
import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { createRepositories } from "~/infrastructure/database/repositories";
import { resolveEmbeddingRuntimeTarget } from "~/infrastructure/providers/capabilities/embedding/helpers";
import {
  decodeEmbeddingRuntimeTarget,
  toEmbeddingRuntimeTarget,
} from "~/infrastructure/providers/capabilities/embedding/target";
import { runCommitEnrichers } from "~/modules/knowledge/application/enrichment/run";
import type { PendingEmbeddingDocument } from "~/modules/knowledge/application/index/chunks";
import {
  cleanupStaleIndexes,
  insertResourceVectors,
} from "~/modules/knowledge/application/index/vectors";
import { readKnowledgeText } from "~/modules/knowledge/application/intake/body";
import {
  KnowledgeIndexRepository,
  type IndexableResource,
  type IndexedResourceType,
} from "~/modules/knowledge/infrastructure/KnowledgeIndexRepository";
import { requireMemoryDocumentAccess } from "~/modules/memory-documents/application/memory-documents";
import { readMemoryDocumentDetails } from "~/modules/memory-documents/domain/details";
import { requireOutputAccess } from "~/modules/outputs/application/access";
import { outputKnowledgeText } from "~/modules/outputs/domain/knowledge-text";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { requireSourceAccess } from "~/modules/sources/application/sources";
import { readSourceSummary, renderSourceSummary } from "~/modules/sources/domain/summary";
import type { SourceRecord } from "~/modules/sources/infrastructure/SourceRepository";
import { getRequestUserSettings } from "~/modules/user/application/request-settings";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import type { EmbeddingRuntimeTarget, IEnv } from "~/types";

const CHUNK_CHARACTERS = 2048;

const PLATFORM_EMBEDDING_TARGET = toEmbeddingRuntimeTarget({
  provider: "vectorize",
  target: "vectorize-binding",
  model: WORKERS_EMBEDDING_MODEL,
  vectorSpace: "default",
  vectorSpaceVersion: EMBEDDING_VECTOR_SPACE_VERSION,
});

async function chooseEmbeddingTarget(
  context: ServiceContext,
  resource: IndexableResource,
): Promise<EmbeddingRuntimeTarget> {
  const settings = resource.project_id ? null : await getRequestUserSettings(context);

  return settings
    ? resolveEmbeddingRuntimeTarget(context.env, context.requireUser(), settings)
    : PLATFORM_EMBEDDING_TARGET;
}

async function documentDigest(resource: IndexableResource): Promise<string> {
  return sha256Hex(
    resource.resource_type === "source"
      ? `${resource.id}:${resource.search_revision}`
      : `${resource.resource_type}:${resource.id}:${resource.search_revision}`,
  );
}

async function prepareSearchDocument(
  resource: IndexableResource,
  text: string,
): Promise<PendingEmbeddingDocument> {
  const digest = await documentDigest(resource);
  const metadata = parseJsonRecord(resource.metadata);
  const format = metadata.uploadType === "code" ? "blocks" : "markdown";
  const chunks = chunkKnowledgeText(text, { maxChars: CHUNK_CHARACTERS, format });
  const summary = resource.resource_type === "source" ? readSourceSummary(metadata) : null;
  const parts: { content: string; metadata?: Record<string, unknown> }[] = chunks.map(
    (content) => ({ content }),
  );

  if (summary) {
    parts.push({
      content: `${resource.title}\n\n${renderSourceSummary(summary)}`,
      metadata: { summary: true },
    });
  }

  return {
    documentId: `srcidx_${digest.slice(0, 56)}`,
    logicalId: resource.id,
    content: text,
    title: resource.title,
    chunks: parts.map((part, index) => ({
      id: `srcv_${digest.slice(0, 50)}_${index}`,
      vectorId: `srcv_${digest.slice(0, 50)}_${index}`,
      index,
      content: part.content,
      ...(part.metadata ? { metadata: part.metadata } : {}),
    })),
  };
}

async function readIndexText(
  context: ServiceContext,
  resource: IndexableResource,
): Promise<{ text: string; source: SourceRecord | null }> {
  if (resource.resource_type === "memory") {
    const document = await requireMemoryDocumentAccess(context, resource.id);
    const { description } = readMemoryDocumentDetails(document);

    return {
      text: [`# ${document.name}`, description, document.content].filter(Boolean).join("\n\n"),
      source: null,
    };
  }

  if (resource.resource_type === "output") {
    await requireOutputAccess(context, context.requireUser().id, resource.id);

    return {
      text: outputKnowledgeText(resource.kind, resource.title, resource.content),
      source: null,
    };
  }

  const source = await requireSourceAccess(context, context.requireUser().id, resource.id);

  return { text: await readKnowledgeText(context, source), source };
}

export async function indexKnowledgeResource(
  context: ServiceContext,
  resourceType: IndexedResourceType,
  resourceId: string,
  assertOwned: () => Promise<void>,
): Promise<void> {
  await assertOwned();
  await cleanupStaleIndexes(context, resourceType, resourceId);
  const index = context.repositories.get(KnowledgeIndexRepository);
  const resource = await index.getResource(resourceType, resourceId);

  if (
    !resource ||
    (resource.resource_type === "source" && resource.kind === "memory") ||
    resource.status !== "available"
  ) {
    return;
  }

  const { text, source } = await readIndexText(context, resource);

  if (!text.trim()) {
    return;
  }

  if (source) {
    await runCommitEnrichers(context, source, text);
  }

  const current = (await index.getResource(resourceType, resourceId)) ?? resource;
  const existing = await index.getDocument(resourceType, current.id, current.search_revision);

  if (existing?.status === "active") {
    return;
  }

  const document = await prepareSearchDocument(current, text);
  const target = existing
    ? decodeEmbeddingRuntimeTarget(existing.target)
    : await chooseEmbeddingTarget(context, current);

  await index.prepare(current, document, target, context.requireUser().id);

  if (!context.env.AI || !context.env.VECTOR_DB) {
    return;
  }

  const token = generateId();

  if (!(await index.claim(document.documentId, token, "lexical"))) {
    return;
  }

  try {
    await assertOwned();
    await insertResourceVectors(context, current, document.documentId, target, token, assertOwned);
  } finally {
    await index.release(document.documentId, token);
  }
}

export async function enqueueKnowledgeProcessing(
  env: IEnv,
  resource: { id: string; project_id: string | null },
  userId: number,
  resourceType: IndexedResourceType = "source",
): Promise<void> {
  await new TaskService(env, new TaskRepository(env)).enqueueTask({
    task_type: SOURCE_KNOWLEDGE_INDEX_TASK_TYPE,
    user_id: userId,
    project_id: resource.project_id ?? undefined,
    task_data: { sourceId: resource.id, resourceType },
  });
}

export async function scheduleKnowledgeIndexes(env: IEnv): Promise<number> {
  const candidates = await new KnowledgeIndexRepository(env).maintenance(
    Boolean(env.AI && env.VECTOR_DB),
    true,
  );
  const tasks = new TaskService(env, new TaskRepository(env));

  for (const candidate of candidates) {
    await tasks.enqueueTask({
      task_type: SOURCE_KNOWLEDGE_INDEX_TASK_TYPE,
      user_id: candidate.user_id ?? undefined,
      project_id: candidate.project_id ?? undefined,
      task_data: { sourceId: candidate.id, resourceType: candidate.resource_type },
    });
  }

  return candidates.length;
}

export async function indexResourceForUser(
  env: IEnv,
  userId: number | undefined,
  resourceType: IndexedResourceType,
  resourceId: string,
  assertOwned: () => Promise<void>,
): Promise<void> {
  const repositories = createRepositories(env);
  const user = userId ? await repositories.get(UserRepository).getUserById(userId) : null;

  if (!user) {
    await cleanupStaleIndexes({ env, repositories }, resourceType, resourceId);

    return;
  }

  await indexKnowledgeResource(
    createServiceContext({ env, user }),
    resourceType,
    resourceId,
    assertOwned,
  );
}
