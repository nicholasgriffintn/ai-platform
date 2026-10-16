import {
  excerptMemoryDocument,
  type CreateMemoryDocumentInput,
  type MemoryDocument,
  type MemoryDocumentRevision,
  type MemoryDocumentSummary,
  type UpdateMemoryDocumentInput,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { toStringValue } from "@ngriffin_uk/polychat-utility-server/strings";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { MemoryDocumentRow } from "~/infrastructure/database/schema";
import { requireConversationAccess } from "~/modules/conversations/application/access";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import type { MemoryDocumentScopeKey } from "~/modules/memory-documents/infrastructure/MemoryDocumentRepository";
import { MemoryDocumentRepository } from "~/modules/memory-documents/infrastructure/MemoryDocumentRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

const CONVERSATION_BRIEF_TEMPLATE = `# Objective

# Constraints

# Decisions

# Sources and outputs

# Unfinished work
`;

async function resolveScope(
  context: ServiceContext,
  projectId: string | undefined,
): Promise<MemoryDocumentScopeKey> {
  const user = context.requireUser();

  if (!projectId) {
    return { scopeType: "personal", scopeId: String(user.id) };
  }

  await requireProjectAccess(context, projectId);

  return { scopeType: "project", scopeId: projectId };
}

export function formatMemoryDocument(row: MemoryDocumentRow): MemoryDocument {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    revision: row.revision,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function conversationScope(conversation: Record<string, unknown>): MemoryDocumentScopeKey {
  return typeof conversation.project_id === "string"
    ? { scopeType: "project", scopeId: conversation.project_id }
    : { scopeType: "personal", scopeId: toStringValue(conversation.user_id, "") };
}

function documentMatchesScope(document: MemoryDocumentRow, scope: MemoryDocumentScopeKey): boolean {
  return document.scope_type === scope.scopeType && document.scope_id === scope.scopeId;
}

async function getConversationBrief(
  context: ServiceContext,
  conversationId: string,
): Promise<MemoryDocument | null> {
  context.ensureDatabase();
  const conversation = await requireConversationAccess(context, conversationId);
  const documentId = conversation.brief_document_id;

  if (typeof documentId !== "string") {
    return null;
  }

  const document = await context.repositories
    .get(MemoryDocumentRepository)
    .getDocumentById(documentId);

  if (!document || !documentMatchesScope(document, conversationScope(conversation))) {
    throw new AssistantError("Conversation brief is unavailable", ErrorType.FORBIDDEN, 403);
  }

  return formatMemoryDocument(document);
}

export async function ensureConversationBrief(
  context: ServiceContext,
  conversationId: string,
): Promise<MemoryDocument | null> {
  const existing = await getConversationBrief(context, conversationId);

  if (existing) {
    return existing;
  }

  const user = context.requireUser();
  const conversation = await requireConversationAccess(context, conversationId);
  const created = await context.repositories.get(MemoryDocumentRepository).createDocument({
    ...conversationScope(conversation),
    kind: "conversation_brief",
    name: `conversation-brief-${generateId().replaceAll("-", "").toLowerCase()}`,
    content: CONVERSATION_BRIEF_TEMPLATE,
    createdByUserId: user.id,
  });

  if (
    await context.repositories
      .get(ConversationRepository)
      .assignBriefDocument(conversationId, created.id)
  ) {
    return formatMemoryDocument(created);
  }

  await context.repositories.get(MemoryDocumentRepository).softDeleteDocument(created.id);

  return getConversationBrief(context, conversationId);
}

export async function copyConversationBrief(
  context: ServiceContext,
  sourceConversationId: string,
  targetConversationId: string,
): Promise<MemoryDocument | null> {
  const source = await getConversationBrief(context, sourceConversationId);

  if (!source) {
    return null;
  }

  const user = context.requireUser();
  const target = await requireConversationAccess(context, targetConversationId);
  const created = await context.repositories.get(MemoryDocumentRepository).createDocument({
    ...conversationScope(target),
    kind: "conversation_brief",
    name: `conversation-brief-${generateId().replaceAll("-", "").toLowerCase()}`,
    content: source.content,
    createdByUserId: user.id,
  });

  if (
    await context.repositories
      .get(ConversationRepository)
      .assignBriefDocument(targetConversationId, created.id)
  ) {
    return formatMemoryDocument(created);
  }

  await context.repositories.get(MemoryDocumentRepository).softDeleteDocument(created.id);
  throw new AssistantError(
    "The new conversation could not be bound to its brief",
    ErrorType.CONFLICT_ERROR,
    409,
  );
}

function toSummary(row: MemoryDocumentRow): MemoryDocumentSummary {
  const { content, ...rest } = formatMemoryDocument(row);

  return { ...rest, excerpt: excerptMemoryDocument(content) };
}

export async function listMemoryDocuments(
  context: ServiceContext,
  projectId?: string,
): Promise<{ documents: MemoryDocumentSummary[] }> {
  context.ensureDatabase();
  const scope = await resolveScope(context, projectId);
  const rows = await context.repositories.get(MemoryDocumentRepository).listDocuments(scope);

  return { documents: rows.map(toSummary) };
}

export async function getMemoryDocument(
  context: ServiceContext,
  name: string,
  projectId?: string,
): Promise<MemoryDocument> {
  context.ensureDatabase();
  const scope = await resolveScope(context, projectId);
  const row = await context.repositories
    .get(MemoryDocumentRepository)
    .getDocumentByName(scope, name);

  if (!row) {
    throw new AssistantError("Memory document not found", ErrorType.NOT_FOUND, 404);
  }

  return formatMemoryDocument(row);
}

export async function createMemoryDocument(
  context: ServiceContext,
  input: CreateMemoryDocumentInput,
): Promise<MemoryDocument> {
  context.ensureDatabase();
  const user = context.requireUser();
  const scope = await resolveScope(context, input.projectId);
  const existing = await context.repositories
    .get(MemoryDocumentRepository)
    .getDocumentByName(scope, input.name);

  if (existing) {
    throw new AssistantError(
      `A memory document called ${input.name} already exists here`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const created = await context.repositories.get(MemoryDocumentRepository).createDocument({
    ...scope,
    name: input.name,
    content: input.content ?? "",
    createdByUserId: user.id,
  });

  return formatMemoryDocument(created);
}

export async function updateMemoryDocument(
  context: ServiceContext,
  name: string,
  input: UpdateMemoryDocumentInput,
): Promise<MemoryDocument> {
  context.ensureDatabase();
  const user = context.requireUser();
  const scope = await resolveScope(context, input.projectId);
  const existing = await context.repositories
    .get(MemoryDocumentRepository)
    .getDocumentByName(scope, name);

  if (!existing) {
    throw new AssistantError("Memory document not found", ErrorType.NOT_FOUND, 404);
  }

  const updated = await context.repositories.get(MemoryDocumentRepository).appendRevision({
    documentId: existing.id,
    content: input.content,
    changeNote: input.changeNote ?? null,
    createdByUserId: user.id,
    expectedRevision: input.expectedRevision,
  });

  if (!updated) {
    throw new AssistantError(
      "This memory document changed while you were editing it. Reload and try again.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return formatMemoryDocument(updated);
}

export async function deleteMemoryDocument(
  context: ServiceContext,
  name: string,
  projectId?: string,
): Promise<void> {
  context.ensureDatabase();
  const scope = await resolveScope(context, projectId);
  const existing = await context.repositories
    .get(MemoryDocumentRepository)
    .getDocumentByName(scope, name);

  if (!existing) {
    throw new AssistantError("Memory document not found", ErrorType.NOT_FOUND, 404);
  }

  await context.repositories.get(MemoryDocumentRepository).softDeleteDocument(existing.id);
}

export async function listMemoryDocumentRevisions(
  context: ServiceContext,
  name: string,
  projectId?: string,
): Promise<{ revisions: MemoryDocumentRevision[] }> {
  context.ensureDatabase();
  const scope = await resolveScope(context, projectId);
  const existing = await context.repositories
    .get(MemoryDocumentRepository)
    .getDocumentByName(scope, name);

  if (!existing) {
    throw new AssistantError("Memory document not found", ErrorType.NOT_FOUND, 404);
  }

  const rows = await context.repositories.get(MemoryDocumentRepository).listRevisions(existing.id);

  return {
    revisions: rows.map((row) => ({
      id: row.id,
      revision: row.revision,
      content: row.content,
      changeNote: row.change_note,
      createdAt: row.created_at,
    })),
  };
}
