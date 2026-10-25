import { getPromptText, renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import {
  memoryDocumentDraftSchema,
  memoryPlacementSchema,
  type MemoryDocumentDraft,
  type ModelTier,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { MemoryDocumentRow } from "~/infrastructure/database/schema";
import {
  describeMemoryDocument,
  readMemoryDocumentDetails,
} from "~/modules/memory-documents/domain/details";
import {
  MemoryDocumentRepository,
  type MemoryDocumentScopeKey,
} from "~/modules/memory-documents/infrastructure/MemoryDocumentRepository";
import { generateTierObject } from "~/modules/models/application/tier-object";

const MEMORY_WRITER_TIER: ModelTier = "low";
const MAX_WRITE_ATTEMPTS = 3;

export interface MemoryNote {
  text: string;
  category?: string;
  conversationId?: string;
  operationId?: string;
}

function renderMemoryIndex(documents: readonly MemoryDocumentRow[]): string {
  if (documents.length === 0) {
    return "There are no memory documents yet.";
  }

  return documents
    .map((document) => {
      const { type } = readMemoryDocumentDetails(document);

      return `- ${document.name}${type ? ` (${type})` : ""}: ${describeMemoryDocument(document)}`;
    })
    .join("\n");
}

function renderMemoryNote(note: MemoryNote): string {
  return [
    `New memory: ${note.text.trim()}`,
    note.category ? `Category: ${note.category}` : "",
    note.conversationId ? `From conversation: ${note.conversationId}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function placeMemory(
  context: ServiceContext,
  documents: readonly MemoryDocumentRow[],
  note: MemoryNote,
): Promise<string> {
  const { name } = await generateTierObject(context, {
    tier: MEMORY_WRITER_TIER,
    name: "memory_placement",
    schema: memoryPlacementSchema,
    system: getPromptText("memory/documents/placement"),
    material: `## Memory documents\n\n${renderMemoryIndex(documents)}\n\n## To remember\n\n${renderMemoryNote(note)}`,
  });

  return name;
}

function draftMemoryDocument(
  context: ServiceContext,
  name: string,
  existing: MemoryDocumentRow | null,
  others: readonly MemoryDocumentRow[],
  note: MemoryNote,
): Promise<MemoryDocumentDraft> {
  const details = existing ? readMemoryDocumentDetails(existing) : null;
  const current = existing
    ? [
        `Description: ${details?.description || "(none)"}`,
        `Type: ${details?.type ?? "(none)"}`,
        "",
        existing.content.trim() || "(empty)",
      ].join("\n")
    : "This document is new.";

  return generateTierObject(context, {
    tier: MEMORY_WRITER_TIER,
    name: "memory_document",
    schema: memoryDocumentDraftSchema,
    system: renderPrompt("memory/documents/write", {
      todaysDate: new Date().toISOString().slice(0, 10),
    }),
    material: [
      `## Document: ${name}`,
      current,
      `## Other memory documents\n\n${renderMemoryIndex(others.filter((other) => other.name !== name))}`,
      `## To remember\n\n${renderMemoryNote(note)}`,
    ].join("\n\n"),
  });
}

async function writeIntoDocument(
  context: ServiceContext,
  document: MemoryDocumentRow,
  draft: MemoryDocumentDraft,
  userId: number,
  operationId: string | undefined,
): Promise<MemoryDocumentRow | null> {
  return context.repositories.get(MemoryDocumentRepository).appendRevision({
    documentId: document.id,
    content: draft.content,
    details: { description: draft.description, type: draft.type },
    changeNote: draft.changeNote,
    createdByUserId: userId,
    expectedRevision: document.revision,
    operationId,
  });
}

function conflict(): AssistantError {
  return new AssistantError(
    "This memory changed repeatedly while it was being saved. Try again.",
    ErrorType.CONFLICT_ERROR,
    409,
  );
}

export async function rememberInScope(
  context: ServiceContext,
  scope: MemoryDocumentScopeKey,
  userId: number,
  note: MemoryNote,
): Promise<MemoryDocumentRow> {
  const repository = context.repositories.get(MemoryDocumentRepository);
  const documents = await repository.listDocuments(scope);
  const name = await placeMemory(context, documents, note);

  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
    const existing = await repository.getDocumentByName(scope, name);
    const draft = await draftMemoryDocument(context, name, existing, documents, note);

    if (existing) {
      const written = await writeIntoDocument(context, existing, draft, userId, note.operationId);

      if (written) {
        return written;
      }

      continue;
    }

    try {
      return await repository.createDocument({
        ...scope,
        name,
        content: draft.content,
        details: { description: draft.description, type: draft.type },
        createdByUserId: userId,
        operationId: note.operationId,
      });
    } catch (error) {
      if (!(await repository.getDocumentByName(scope, name))) {
        throw error;
      }
    }
  }

  throw conflict();
}

export async function rememberInDocument(
  context: ServiceContext,
  document: MemoryDocumentRow,
  userId: number,
  note: MemoryNote,
): Promise<MemoryDocumentRow> {
  const repository = context.repositories.get(MemoryDocumentRepository);
  let current: MemoryDocumentRow | null = document;

  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS && current; attempt += 1) {
    const draft = await draftMemoryDocument(context, current.name, current, [], note);
    const written = await writeIntoDocument(context, current, draft, userId, note.operationId);

    if (written) {
      return written;
    }

    current = await repository.getDocumentById(document.id);
  }

  throw conflict();
}
