import type {
  CreateSourceCollectionInput,
  CreateSourceInput,
  Source,
  SourceCollection,
  SourceSummary,
  UpdateSourceInput,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { MemoryManager } from "~/lib/memory";
import { isMemoryProviderId } from "~/lib/providers/capabilities/memory/helpers";
import type {
  SourceCollectionRecord,
  SourceRecord,
  SourceSummaryRecord,
} from "~/repositories/SourceRepository";
import { recordProjectAudit } from "~/services/audit";
import { requireProjectAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";

function formatFile(record: SourceRecord): Source["file"] {
  if (!record.storage_key || !record.mime_type) {
    return null;
  }

  return {
    key: record.storage_key,
    mimeType: record.mime_type,
    filename: record.filename,
    byteSize: record.byte_size,
  };
}

export function formatSource(record: SourceRecord): Source {
  const metadata = safeParseJson<Record<string, unknown>>(record.metadata) ?? {};

  if (record.kind === "memory") {
    delete metadata.embedding_provider_target;
  }

  return {
    id: record.id,
    createdByUserId: record.created_by_user_id,
    projectId: record.project_id,
    conversationId: record.conversation_id,
    connectionId: record.connection_id,
    kind: record.kind,
    title: record.title,
    status: record.status,
    content: record.content,
    provider: record.provider,
    externalUri: record.external_uri,
    vectorId: record.vector_id,
    metadata,
    file: formatFile(record),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function formatSourceSummary(record: SourceSummaryRecord): SourceSummary {
  const { content: _content, ...summary } = formatSource({ ...record, content: null });

  return summary;
}

function formatCollection(record: SourceCollectionRecord): SourceCollection {
  return {
    id: record.id,
    createdByUserId: record.created_by_user_id,
    projectId: record.project_id,
    title: record.title,
    description: record.description,
    kind: record.kind,
    sourceCount: Number(record.source_count ?? 0),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

async function requireSourceAccess(
  context: ServiceContext,
  userId: number,
  sourceId: string,
  mutate = false,
): Promise<SourceRecord> {
  const source = await context.repositories.sources.getSource(sourceId);

  if (!source) {
    throw new AssistantError("Source not found", ErrorType.NOT_FOUND, 404);
  }

  if (!source.project_id) {
    if (source.created_by_user_id !== userId) {
      throw new AssistantError("Source not found", ErrorType.NOT_FOUND, 404);
    }

    return source;
  }

  const { role } = await requireProjectAccess(context, source.project_id);

  if (mutate && role === "member" && source.created_by_user_id !== userId) {
    throw new AssistantError(
      "Only the source creator or a project admin can change it",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  return source;
}

async function requireSourcesAccess(
  context: ServiceContext,
  userId: number,
  sourceIds: string[],
  validate?: (source: SourceRecord) => void,
): Promise<SourceRecord[]> {
  const records = await context.repositories.sources.getSourcesByIds(sourceIds);
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const verifiedProjects = new Set<string>();
  const sources: SourceRecord[] = [];

  for (const sourceId of sourceIds) {
    const source = recordsById.get(sourceId);

    if (!source) {
      throw new AssistantError("Source not found", ErrorType.NOT_FOUND, 404);
    }

    if (!source.project_id) {
      if (source.created_by_user_id !== userId) {
        throw new AssistantError("Source not found", ErrorType.NOT_FOUND, 404);
      }
    } else if (!verifiedProjects.has(source.project_id)) {
      await requireProjectAccess(context, source.project_id);
      verifiedProjects.add(source.project_id);
    }

    validate?.(source);
    sources.push(source);
  }

  return sources;
}

async function requireCollectionAccess(
  context: ServiceContext,
  userId: number,
  collectionId: string,
  mutate = false,
): Promise<SourceCollectionRecord> {
  const collection = await context.repositories.sources.getCollection(collectionId);

  if (!collection) {
    throw new AssistantError("Source collection not found", ErrorType.NOT_FOUND, 404);
  }

  if (!collection.project_id) {
    if (collection.created_by_user_id !== userId) {
      throw new AssistantError("Source collection not found", ErrorType.NOT_FOUND, 404);
    }

    return collection;
  }

  const { role } = await requireProjectAccess(context, collection.project_id);

  if (mutate && role === "member" && collection.created_by_user_id !== userId) {
    throw new AssistantError(
      "Only the collection creator or a project admin can change it",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  return collection;
}

export async function createSource(
  context: ServiceContext,
  userId: number,
  input: CreateSourceInput,
): Promise<Source> {
  if (input.projectId) {
    await requireProjectAccess(context, input.projectId);
  }

  if (input.conversationId) {
    const conversation = await context.repositories.conversations.getConversation(
      input.conversationId,
    );

    if (
      !conversation ||
      conversation.project_id !== (input.projectId ?? null) ||
      (!input.projectId && conversation.user_id !== userId)
    ) {
      throw new AssistantError("Conversation not found in source scope", ErrorType.NOT_FOUND, 404);
    }
  }

  if (input.connectionId) {
    const connection = await context.repositories.providerConnections.getConnectionById(
      input.connectionId,
    );

    if (!connection || connection.user_id !== userId) {
      throw new AssistantError("Connection not found", ErrorType.NOT_FOUND, 404);
    }
  }

  const created = await context.repositories.sources.createSource({
    createdByUserId: userId,
    projectId: input.projectId,
    conversationId: input.conversationId,
    connectionId: input.connectionId,
    kind: input.kind,
    title: input.title,
    status: input.status,
    content: input.content,
    provider: input.provider,
    externalUri: input.externalUri,
    vectorId: input.vectorId,
    metadata: input.metadata,
    storageKey: input.file?.key,
    mimeType: input.file?.mimeType,
    filename: input.file?.filename,
    byteSize: input.file?.byteSize,
  });

  if (created.project_id) {
    await recordProjectAudit(context, created.project_id, {
      actorUserId: userId,
      action: "source.created",
      targetType: "source",
      targetId: created.id,
      metadata: { kind: created.kind },
    });
  }

  return formatSource(created);
}

export async function getSource(context: ServiceContext, userId: number, sourceId: string) {
  return formatSource(await requireSourceAccess(context, userId, sourceId));
}

export async function listSources(
  context: ServiceContext,
  userId: number,
  filters: { projectId?: string; kind?: SourceRecord["kind"] },
): Promise<{ sources: SourceSummary[] }> {
  const records = filters.projectId
    ? (await requireProjectAccess(context, filters.projectId),
      await context.repositories.sources.listProjectSourceSummaries(
        filters.projectId,
        filters.kind,
      ))
    : await context.repositories.sources.listPersonalSourceSummaries(userId, filters.kind);

  return { sources: records.map(formatSourceSummary) };
}

export async function updateSource(
  context: ServiceContext,
  userId: number,
  sourceId: string,
  input: UpdateSourceInput,
): Promise<Source> {
  const existing = await requireSourceAccess(context, userId, sourceId, true);

  if (
    existing.kind === "memory" &&
    (input.status !== undefined || input.content !== undefined || input.metadata !== undefined)
  ) {
    throw new AssistantError(
      "Memory content, lifecycle, and provider metadata are managed by the memory service",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  await context.repositories.sources.updateSource(sourceId, input);
  const updated = await context.repositories.sources.getSource(sourceId);

  if (!updated) {
    throw new AssistantError("Source not found", ErrorType.NOT_FOUND, 404);
  }

  if (existing.project_id) {
    await recordProjectAudit(context, existing.project_id, {
      actorUserId: userId,
      action: "source.updated",
      targetType: "source",
      targetId: sourceId,
    });
  }

  return formatSource(updated);
}

export async function deleteSource(
  context: ServiceContext,
  userId: number,
  sourceId: string,
): Promise<void> {
  const source = await requireSourceAccess(context, userId, sourceId, true);

  if (source.kind === "memory") {
    const metadata = safeParseJson<Record<string, unknown>>(source.metadata);
    const recordedProvider = metadata?.memory_provider ?? source.provider;
    const providerId = isMemoryProviderId(recordedProvider) ? recordedProvider : "built-in";
    const memoryManager = MemoryManager.getInstance(
      context.env,
      context.user ?? undefined,
      context,
      source.project_id ? { type: "project", projectId: source.project_id } : { type: "personal" },
    );
    const deleted = await memoryManager.deleteMemory(sourceId, providerId);

    if (!deleted) {
      throw new AssistantError(
        "Memory could not be deleted from its provider",
        ErrorType.PROVIDER_ERROR,
        502,
      );
    }

    if (source.project_id) {
      await recordProjectAudit(context, source.project_id, {
        actorUserId: userId,
        action: "source.deleted",
        targetType: "source",
        targetId: sourceId,
      });
    }

    return;
  }

  await context.repositories.sources.deleteSource(sourceId);
  if (source.project_id) {
    await recordProjectAudit(context, source.project_id, {
      actorUserId: userId,
      action: "source.deleted",
      targetType: "source",
      targetId: sourceId,
    });
  }
}

export async function createSourceCollection(
  context: ServiceContext,
  userId: number,
  input: CreateSourceCollectionInput,
): Promise<SourceCollection> {
  if (input.projectId) {
    await requireProjectAccess(context, input.projectId);
  }

  return formatCollection(
    await context.repositories.sources.createCollection({
      createdByUserId: userId,
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      kind: input.kind,
    }),
  );
}

export async function listSourceCollections(
  context: ServiceContext,
  userId: number,
  projectId?: string,
): Promise<{ collections: SourceCollection[] }> {
  const records = projectId
    ? (await requireProjectAccess(context, projectId),
      await context.repositories.sources.listProjectCollections(projectId))
    : await context.repositories.sources.listPersonalCollections(userId);

  return { collections: records.map(formatCollection) };
}

export async function listCollectionSources(
  context: ServiceContext,
  userId: number,
  collectionId: string,
): Promise<{ sources: SourceSummary[] }> {
  await requireCollectionAccess(context, userId, collectionId);

  return {
    sources: (await context.repositories.sources.listCollectionSources(collectionId)).map(
      formatSourceSummary,
    ),
  };
}

export async function listProjectContextSources(
  context: ServiceContext,
  userId: number,
  projectId: string,
): Promise<{ sources: SourceSummary[] }> {
  await requireProjectAccess(context, projectId);
  const collection = await context.repositories.sources.getProjectContextCollection(projectId);

  if (!collection) {
    return { sources: [] };
  }

  return {
    sources: (await context.repositories.sources.listCollectionSources(collection.id)).map(
      formatSourceSummary,
    ),
  };
}

export async function listProjectConversationSources(
  context: ServiceContext,
  userId: number,
  projectId: string,
): Promise<{ sources: Source[] }> {
  await requireProjectAccess(context, projectId);
  const collection = await context.repositories.sources.getProjectContextCollection(projectId);
  const contextSources = collection
    ? await context.repositories.sources.listCollectionSources(collection.id)
    : [];
  const availableSources = new Map<string, SourceRecord>();

  for (const source of contextSources) {
    if (source.status === "available") {
      availableSources.set(source.id, source);
    }
  }

  return { sources: [...availableSources.values()].map(formatSource) };
}

export async function setProjectContextSources(
  context: ServiceContext,
  userId: number,
  projectId: string,
  sourceIds: string[],
): Promise<{ sources: SourceSummary[] }> {
  await requireProjectAccess(context, projectId, ["owner", "admin"]);
  if (new Set(sourceIds).size !== sourceIds.length) {
    throw new AssistantError("Project context sources must be unique", ErrorType.PARAMS_ERROR, 400);
  }

  await requireSourcesAccess(context, userId, sourceIds, (source) => {
    if (source.project_id !== projectId || source.status !== "available") {
      throw new AssistantError(
        "Project context sources must be available in this project",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  });

  const collection = await context.repositories.sources.ensureProjectContextCollection({
    projectId,
    createdByUserId: userId,
  });

  await context.repositories.sources.replaceCollectionSources(collection.id, sourceIds);
  await recordProjectAudit(context, projectId, {
    actorUserId: userId,
    action: "project.context.updated",
    targetType: "project",
    targetId: projectId,
    metadata: { sourceCount: sourceIds.length },
  });

  return listProjectContextSources(context, userId, projectId);
}

export async function addCollectionSources(
  context: ServiceContext,
  userId: number,
  collectionId: string,
  sourceIds: string[],
): Promise<{ added: number }> {
  const collection = await requireCollectionAccess(context, userId, collectionId, true);

  await requireSourcesAccess(context, userId, sourceIds, (source) => {
    if (source.project_id !== collection.project_id) {
      throw new AssistantError(
        "Source is outside this collection scope",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  });

  return {
    added: await context.repositories.sources.addCollectionSources(collectionId, sourceIds),
  };
}

export async function deleteSourceCollection(
  context: ServiceContext,
  userId: number,
  collectionId: string,
): Promise<void> {
  const collection = await requireCollectionAccess(context, userId, collectionId, true);

  if (collection.kind === "context") {
    throw new AssistantError(
      "Project context is managed from the project overview",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  await context.repositories.sources.deleteCollection(collectionId);
}
