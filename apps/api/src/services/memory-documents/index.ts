import {
  excerptMemoryDocument,
  type CreateMemoryDocumentInput,
  type MemoryDocument,
  type MemoryDocumentRevision,
  type MemoryDocumentSummary,
  type UpdateMemoryDocumentInput,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { MemoryDocumentRow } from "~/lib/database/schema";
import type { MemoryDocumentScopeKey } from "~/repositories/MemoryDocumentRepository";
import { requireProjectAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";

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

function toDocument(row: MemoryDocumentRow): MemoryDocument {
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

function toSummary(row: MemoryDocumentRow): MemoryDocumentSummary {
  const { content, ...rest } = toDocument(row);

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

  return toDocument(row);
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

  return toDocument(created);
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

  return toDocument(updated);
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
