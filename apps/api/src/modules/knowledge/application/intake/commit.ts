import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import {
  KNOWLEDGE_BODY_METADATA_KEY,
  KNOWLEDGE_EXPIRES_METADATA_KEY,
  KNOWLEDGE_ORIGIN_METADATA_KEY,
  KNOWLEDGE_UPSTREAM_METADATA_KEY,
} from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ProviderConnectionRepository } from "~/modules/connectors/infrastructure/ProviderConnectionRepository";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { publishKnowledgeChange } from "~/modules/knowledge/application/events";
import { enqueueKnowledgeProcessing } from "~/modules/knowledge/application/index/indexing";
import {
  deleteKnowledgeBodies,
  prepareKnowledgeBody,
  type PreparedKnowledgeBody,
} from "~/modules/knowledge/application/intake/body";
import {
  readKnowledgeBody,
  withReservedKnowledgeMetadata,
} from "~/modules/knowledge/domain/envelope";
import {
  knowledgeScopeKey,
  type KnowledgeDocument,
  type KnowledgeTarget,
} from "~/modules/knowledge/domain/item";
import { KnowledgeDocumentRepository } from "~/modules/knowledge/infrastructure/KnowledgeDocumentRepository";
import type { SourceRecord } from "~/modules/sources/infrastructure/SourceRepository";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";
import { recordProjectAudit } from "~/modules/workspaces/application/audit";

export async function knowledgeSourceId(
  target: Pick<KnowledgeTarget, "userId" | "projectId">,
  key: string,
): Promise<string> {
  return `kb_${(await sha256Hex(`${knowledgeScopeKey(target)}:${key}`)).slice(0, 40)}`;
}

function scopeConflict(): AssistantError {
  return new AssistantError(
    "This knowledge document belongs to another scope",
    ErrorType.CONFLICT_ERROR,
    409,
  );
}

async function requireDocumentLinks(
  context: ServiceContext,
  target: KnowledgeTarget,
  document: KnowledgeDocument,
): Promise<void> {
  if (document.conversationId) {
    const conversation = await context.repositories
      .get(ConversationRepository)
      .getConversation(document.conversationId);

    if (
      !conversation ||
      conversation.project_id !== target.projectId ||
      (!target.projectId && !ownsResource(target.userId, conversation.user_id))
    ) {
      throw new AssistantError("Conversation not found in source scope", ErrorType.NOT_FOUND, 404);
    }
  }

  if (document.connectionId) {
    const connection = await context.repositories
      .get(ProviderConnectionRepository)
      .getConnectionById(document.connectionId);

    if (!connection || !ownsResource(target.userId, connection.user_id)) {
      throw new AssistantError("Connection not found", ErrorType.NOT_FOUND, 404);
    }
  }
}

function envelope(
  document: KnowledgeDocument,
  previous: Record<string, unknown>,
  prepared: PreparedKnowledgeBody | null,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    ...previous,
    ...withReservedKnowledgeMetadata(document.metadata, {
      ...previous,
      ...(document.metadata.syncId === undefined ? {} : { syncId: document.metadata.syncId }),
    }),
    [KNOWLEDGE_ORIGIN_METADATA_KEY]: previous[KNOWLEDGE_ORIGIN_METADATA_KEY] ?? document.origin,
  };

  if (document.upstream) {
    metadata[KNOWLEDGE_UPSTREAM_METADATA_KEY] = document.upstream;
  }

  if (document.expiresAt !== undefined) {
    if (document.expiresAt) {
      metadata[KNOWLEDGE_EXPIRES_METADATA_KEY] = document.expiresAt;
    } else {
      delete metadata[KNOWLEDGE_EXPIRES_METADATA_KEY];
    }
  }

  if (document.immutable) {
    metadata.immutableSnapshot = true;
  }

  if (prepared) {
    if (prepared.body) {
      metadata[KNOWLEDGE_BODY_METADATA_KEY] = prepared.body;
    } else {
      delete metadata[KNOWLEDGE_BODY_METADATA_KEY];
    }
  }

  return metadata;
}

async function updateExisting(
  context: ServiceContext,
  target: KnowledgeTarget,
  document: KnowledgeDocument,
  existing: SourceRecord,
): Promise<{ prepared: PreparedKnowledgeBody | null }> {
  const previous = parseJsonRecord(existing.metadata);
  const sameScope =
    existing.project_id === target.projectId &&
    (target.projectId !== null || existing.created_by_user_id === target.userId);

  if (sameScope && document.immutable && previous.immutableSnapshot === true) {
    return { prepared: null };
  }

  if (
    existing.project_id !== target.projectId ||
    (!target.projectId && existing.created_by_user_id !== target.userId) ||
    existing.kind === "memory" ||
    previous.immutableSnapshot === true
  ) {
    throw scopeConflict();
  }

  const prepared =
    document.content === undefined
      ? null
      : await prepareKnowledgeBody(
          context.env,
          document.id,
          document.content,
          readKnowledgeBody(previous),
        );
  const documents = context.repositories.get(KnowledgeDocumentRepository);

  await documents.update(document.id, {
    title: document.title,
    status: document.status ?? "available",
    metadata: envelope(document, previous, prepared),
    ...(prepared ? { content: prepared.content } : {}),
    ...(document.externalUri === undefined ? {} : { externalUri: document.externalUri }),
  });

  if (prepared?.changed && prepared.content === existing.content) {
    await documents.markBodyChanged(document.id);
  }

  return { prepared };
}

async function insertNew(
  context: ServiceContext,
  target: KnowledgeTarget,
  document: KnowledgeDocument,
): Promise<{ prepared: PreparedKnowledgeBody | null; created: boolean }> {
  const prepared =
    document.content === undefined
      ? null
      : await prepareKnowledgeBody(context.env, document.id, document.content, null);
  const { source, created } = await context.repositories.get(KnowledgeDocumentRepository).insert({
    id: document.id,
    createdByUserId: target.userId,
    projectId: target.projectId,
    conversationId: document.conversationId,
    connectionId: document.connectionId,
    kind: document.kind,
    title: document.title,
    status: document.status ?? "available",
    content: prepared?.content ?? "",
    provider: document.provider,
    externalUri: document.externalUri,
    vectorId: document.vectorId,
    metadata: envelope(document, {}, prepared),
    storageKey: document.file?.key,
    mimeType: document.file?.mimeType,
    filename: document.file?.filename,
    byteSize: document.file?.byteSize,
  });

  if (created && source.project_id) {
    await recordProjectAudit(context, source.project_id, {
      actorUserId: target.userId,
      action: "source.created",
      targetType: "source",
      targetId: source.id,
      metadata: { kind: source.kind },
    });
  }

  return { prepared, created };
}

export async function commitKnowledgeDocument(
  context: ServiceContext,
  target: KnowledgeTarget,
  document: KnowledgeDocument,
  options: { process?: boolean } = {},
): Promise<SourceRecord> {
  await requireDocumentLinks(context, target, document);
  const documents = context.repositories.get(KnowledgeDocumentRepository);
  const existing = await documents.find(document.id);
  const { prepared, created } = existing
    ? { ...(await updateExisting(context, target, document, existing)), created: false }
    : await insertNew(context, target, document);

  if (target.collectionIds.length > 0) {
    const sources = context.repositories.get(SourceRepository);

    for (const collectionId of target.collectionIds) {
      await sources.addCollectionSources(collectionId, [document.id]);
    }
  }

  if (prepared?.staleKey) {
    await deleteKnowledgeBodies(context, [prepared.staleKey]);
  }

  const stored = await documents.find(document.id);

  if (!stored) {
    throw new AssistantError("Knowledge document could not be filed", ErrorType.DATABASE_ERROR);
  }

  await publishKnowledgeChange(context, stored, created ? "filed" : "updated", {
    origin: document.origin,
  });

  if (stored.status === "available" && options.process !== false) {
    await enqueueKnowledgeProcessing(context.env, stored, target.userId);
  }

  return stored;
}
