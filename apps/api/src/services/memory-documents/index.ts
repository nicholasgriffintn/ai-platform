import {
  excerptMemoryDocument,
  type CreateMemoryDocumentInput,
  type MemoryDocument,
  type MemoryDocumentRevision,
  type MemoryDocumentSummary,
  type UpdateMemoryDocumentInput,
  type ConversationBriefResponse,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { MemoryDocumentRow } from "~/lib/database/schema";
import type { MemoryDocumentScopeKey } from "~/repositories/MemoryDocumentRepository";
import { requireConversationAccess } from "~/services/conversations/access";
import { publishConversationChanged } from "~/services/sync/conversation-events";
import { requireProjectAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

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
    : { scopeType: "personal", scopeId: String(conversation.user_id) };
}

function documentMatchesScope(document: MemoryDocumentRow, scope: MemoryDocumentScopeKey): boolean {
  return document.scope_type === scope.scopeType && document.scope_id === scope.scopeId;
}

export async function getConversationBrief(
  context: ServiceContext,
  conversationId: string,
): Promise<ConversationBriefResponse> {
  context.ensureDatabase();
  const conversation = await requireConversationAccess(context, conversationId);
  const documentId = conversation.brief_document_id;

  if (typeof documentId !== "string") {
    return { conversationId, document: null };
  }

  const document = await context.repositories.memoryDocuments.getDocumentById(documentId);

  if (!document || !documentMatchesScope(document, conversationScope(conversation))) {
    throw new AssistantError("Conversation brief is unavailable", ErrorType.FORBIDDEN, 403);
  }

  return { conversationId, document: formatMemoryDocument(document) };
}

export async function ensureConversationBrief(
  context: ServiceContext,
  conversationId: string,
): Promise<ConversationBriefResponse> {
  const existing = await getConversationBrief(context, conversationId);

  if (existing.document) {
    return existing;
  }

  const user = context.requireUser();
  const conversation = await requireConversationAccess(context, conversationId);
  const scope = conversationScope(conversation);
  const created = await context.repositories.memoryDocuments.createDocument({
    ...scope,
    kind: "conversation_brief",
    name: `conversation-brief-${generateId().replaceAll("-", "").toLowerCase()}`,
    content: CONVERSATION_BRIEF_TEMPLATE,
    createdByUserId: user.id,
  });

  if (await context.repositories.conversations.assignBriefDocument(conversationId, created.id)) {
    await publishConversationChanged(context, conversationId, {
      briefRevision: created.revision,
    });

    return { conversationId, document: formatMemoryDocument(created) };
  }

  await context.repositories.memoryDocuments.softDeleteDocument(created.id);

  return getConversationBrief(context, conversationId);
}

export async function copyConversationBrief(
  context: ServiceContext,
  sourceConversationId: string,
  targetConversationId: string,
): Promise<ConversationBriefResponse> {
  const source = await getConversationBrief(context, sourceConversationId);

  if (!source.document) {
    return { conversationId: targetConversationId, document: null };
  }

  const user = context.requireUser();
  const target = await requireConversationAccess(context, targetConversationId);
  const created = await context.repositories.memoryDocuments.createDocument({
    ...conversationScope(target),
    kind: "conversation_brief",
    name: `conversation-brief-${generateId().replaceAll("-", "").toLowerCase()}`,
    content: source.document.content,
    createdByUserId: user.id,
  });

  if (
    await context.repositories.conversations.assignBriefDocument(targetConversationId, created.id)
  ) {
    await publishConversationChanged(context, targetConversationId, {
      briefRevision: created.revision,
    });

    return { conversationId: targetConversationId, document: formatMemoryDocument(created) };
  }

  await context.repositories.memoryDocuments.softDeleteDocument(created.id);
  throw new AssistantError(
    "The new conversation could not be bound to its brief",
    ErrorType.CONFLICT_ERROR,
    409,
  );
}

export async function updateConversationBrief(
  context: ServiceContext,
  conversationId: string,
  input: Pick<UpdateMemoryDocumentInput, "content" | "changeNote" | "expectedRevision">,
): Promise<MemoryDocument> {
  const user = context.requireUser();
  const brief = await getConversationBrief(context, conversationId);

  if (!brief.document) {
    throw new AssistantError("Conversation brief not found", ErrorType.NOT_FOUND, 404);
  }

  const updated = await context.repositories.memoryDocuments.appendRevision({
    documentId: brief.document.id,
    content: input.content,
    changeNote: input.changeNote ?? null,
    createdByUserId: user.id,
    expectedRevision: input.expectedRevision,
  });

  if (!updated) {
    throw new AssistantError(
      "This conversation brief changed while you were editing it. Reload and try again.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  await publishConversationChanged(context, conversationId, {
    briefRevision: updated.revision,
  });

  return formatMemoryDocument(updated);
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
  const rows = await context.repositories.memoryDocuments.listDocuments(scope);

  return { documents: rows.map(toSummary) };
}

export async function getMemoryDocument(
  context: ServiceContext,
  name: string,
  projectId?: string,
): Promise<MemoryDocument> {
  context.ensureDatabase();
  const scope = await resolveScope(context, projectId);
  const row = await context.repositories.memoryDocuments.getDocumentByName(scope, name);

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
  const existing = await context.repositories.memoryDocuments.getDocumentByName(scope, input.name);

  if (existing) {
    throw new AssistantError(
      `A memory document called ${input.name} already exists here`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const created = await context.repositories.memoryDocuments.createDocument({
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
  const existing = await context.repositories.memoryDocuments.getDocumentByName(scope, name);

  if (!existing) {
    throw new AssistantError("Memory document not found", ErrorType.NOT_FOUND, 404);
  }

  const updated = await context.repositories.memoryDocuments.appendRevision({
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
  const existing = await context.repositories.memoryDocuments.getDocumentByName(scope, name);

  if (!existing) {
    throw new AssistantError("Memory document not found", ErrorType.NOT_FOUND, 404);
  }

  await context.repositories.memoryDocuments.softDeleteDocument(existing.id);
}

export async function listMemoryDocumentRevisions(
  context: ServiceContext,
  name: string,
  projectId?: string,
): Promise<{ revisions: MemoryDocumentRevision[] }> {
  context.ensureDatabase();
  const scope = await resolveScope(context, projectId);
  const existing = await context.repositories.memoryDocuments.getDocumentByName(scope, name);

  if (!existing) {
    throw new AssistantError("Memory document not found", ErrorType.NOT_FOUND, 404);
  }

  const rows = await context.repositories.memoryDocuments.listRevisions(existing.id);

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
