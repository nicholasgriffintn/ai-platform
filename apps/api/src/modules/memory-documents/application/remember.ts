import { getPromptText, renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import {
  MEMORY_CONSOLIDATION_TASK_TYPE,
  memoryDocumentDraftSchema,
  memoryPlacementSchema,
  type MemoryDocumentDraft,
  type MemoryEvidence,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { MemoryDocumentRow } from "~/infrastructure/database/schema";
import {
  describeMemoryDocument,
  readMemoryDocumentDetails,
} from "~/modules/memory-documents/domain/details";
import {
  appendRecentNote,
  hasRecentNotes,
  shouldAppendMemory,
  splitRecentNotes,
} from "~/modules/memory-documents/domain/notes";
import {
  MemoryDocumentRepository,
  type MemoryDocumentScopeKey,
} from "~/modules/memory-documents/infrastructure/MemoryDocumentRepository";
import { generateSystemObject } from "~/modules/models/application/system-object";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";

const MAX_WRITE_ATTEMPTS = 3;
const MEMORY_CONSOLIDATION_DELAY_MS = 10 * 60 * 1000;

export interface MemoryNote {
  text: string;
  category?: string;
  conversationId?: string;
  operationId?: string;
  evidence?: readonly MemoryEvidence[];
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

function renderMemoryNotes(notes: readonly MemoryNote[]): string {
  return notes
    .map((note, index) =>
      [
        `Memory ${index}: ${note.text.trim()}`,
        note.category ? `Category: ${note.category}` : "",
        note.conversationId ? `From conversation: ${note.conversationId}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

function collectEvidence(notes: readonly MemoryNote[]): MemoryEvidence[] {
  return notes.flatMap((note) => note.evidence ?? []);
}

async function placeMemories(
  context: ServiceContext,
  documents: readonly MemoryDocumentRow[],
  notes: readonly MemoryNote[],
): Promise<Map<string, MemoryNote[]>> {
  const { placements } = await generateSystemObject(context, {
    role: "housekeeping",
    name: "memory_placement",
    schema: memoryPlacementSchema,
    system: getPromptText("memory/documents/placement"),
    material: `## Memory documents\n\n${renderMemoryIndex(documents)}\n\n## To remember\n\n${renderMemoryNotes(notes)}`,
  });
  const groups = new Map<string, MemoryNote[]>();

  notes.forEach((note, index) => {
    const name = placements.find((placement) => placement.memory === index)?.name;

    if (!name) {
      throw new AssistantError(
        "Memory placement left a memory without a document",
        ErrorType.PROVIDER_ERROR,
      );
    }

    groups.set(name, [...(groups.get(name) ?? []), note]);
  });

  return groups;
}

function draftMemoryDocument(
  context: ServiceContext,
  name: string,
  existing: MemoryDocumentRow | null,
  others: readonly MemoryDocumentRow[],
  notes: readonly MemoryNote[],
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

  return generateSystemObject(context, {
    role: "housekeeping",
    name: "memory_document",
    schema: memoryDocumentDraftSchema,
    system: renderPrompt("memory/documents/write", {
      todaysDate: new Date().toISOString().slice(0, 10),
    }),
    material: [
      `## Document: ${name}`,
      current,
      `## Other memory documents\n\n${renderMemoryIndex(others.filter((other) => other.name !== name))}`,
      `## To remember\n\n${renderMemoryNotes(notes)}`,
    ].join("\n\n"),
  });
}

async function writeIntoDocument(
  context: ServiceContext,
  document: MemoryDocumentRow,
  draft: MemoryDocumentDraft,
  userId: number,
  operationId: string | undefined,
  evidence: readonly MemoryEvidence[],
): Promise<MemoryDocumentRow | null> {
  return context.repositories.get(MemoryDocumentRepository).appendRevision({
    documentId: document.id,
    content: draft.content,
    details: { description: draft.description, type: draft.type },
    changeNote: draft.changeNote,
    createdByUserId: userId,
    expectedRevision: document.revision,
    operationId,
    evidence,
  });
}

async function appendIntoDocument(
  context: ServiceContext,
  document: MemoryDocumentRow,
  userId: number,
  notes: readonly MemoryNote[],
  operationId: string | undefined,
): Promise<MemoryDocumentRow | null> {
  const date = new Date().toISOString().slice(0, 10);
  const written = await context.repositories.get(MemoryDocumentRepository).appendRevision({
    documentId: document.id,
    content: notes.reduce(
      (content, note) => appendRecentNote(content, note.text, date),
      document.content,
    ),
    changeNote:
      notes.length === 1
        ? `Noted: ${notes[0].text.trim().slice(0, 120)}`
        : `Noted ${notes.length} things`,
    createdByUserId: userId,
    expectedRevision: document.revision,
    operationId,
    evidence: collectEvidence(notes),
  });

  if (written) {
    await scheduleMemoryConsolidation(context, written, userId);
  }

  return written;
}

async function scheduleMemoryConsolidation(
  context: ServiceContext,
  document: MemoryDocumentRow,
  userId: number,
): Promise<void> {
  const window = Math.floor(Date.now() / MEMORY_CONSOLIDATION_DELAY_MS);

  await new TaskService(context.env, new TaskRepository(context.env)).enqueueTask({
    id: `memory_consolidation_${document.id}_${window}`,
    task_type: MEMORY_CONSOLIDATION_TASK_TYPE,
    user_id: userId,
    task_data: { documentId: document.id },
    schedule_type: "scheduled",
    scheduled_at: new Date(Date.now() + MEMORY_CONSOLIDATION_DELAY_MS).toISOString(),
    priority: 7,
  });
}

async function saveNotes(
  context: ServiceContext,
  document: MemoryDocumentRow,
  others: readonly MemoryDocumentRow[],
  userId: number,
  notes: readonly MemoryNote[],
  operationId: string | undefined,
): Promise<MemoryDocumentRow | null> {
  if (shouldAppendMemory(document.content)) {
    return appendIntoDocument(context, document, userId, notes, operationId);
  }

  const draft = await draftMemoryDocument(context, document.name, document, others, notes);

  return writeIntoDocument(context, document, draft, userId, operationId, collectEvidence(notes));
}

export async function consolidateMemoryDocument(
  context: ServiceContext,
  documentId: string,
  userId: number,
): Promise<MemoryDocumentRow | null> {
  const repository = context.repositories.get(MemoryDocumentRepository);

  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
    const document = await repository.getDocumentById(documentId);

    if (!document || !hasRecentNotes(document.content)) {
      return document;
    }

    const { body, notes } = splitRecentNotes(document.content);
    const others =
      document.kind === "memory"
        ? await repository.listDocuments({
            scopeType: document.scope_type,
            scopeId: document.scope_id,
          })
        : [];
    const draft = await draftMemoryDocument(
      context,
      document.name,
      { ...document, content: body },
      others,
      [{ text: notes }],
    );
    const written = await writeIntoDocument(context, document, draft, userId, undefined, []);

    if (written) {
      return written;
    }
  }

  throw conflict();
}

function conflict(): AssistantError {
  return new AssistantError(
    "This memory changed repeatedly while it was being saved. Try again.",
    ErrorType.CONFLICT_ERROR,
    409,
  );
}

async function fileIntoDocument(
  context: ServiceContext,
  scope: MemoryDocumentScopeKey,
  documents: readonly MemoryDocumentRow[],
  name: string,
  userId: number,
  notes: readonly MemoryNote[],
  operationId: string | undefined,
): Promise<MemoryDocumentRow> {
  const repository = context.repositories.get(MemoryDocumentRepository);

  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
    const existing = await repository.getDocumentByName(scope, name);

    if (existing) {
      const written = await saveNotes(context, existing, documents, userId, notes, operationId);

      if (written) {
        return written;
      }

      continue;
    }

    const draft = await draftMemoryDocument(context, name, null, documents, notes);

    try {
      return await repository.createDocument({
        ...scope,
        name,
        content: draft.content,
        details: { description: draft.description, type: draft.type },
        createdByUserId: userId,
        operationId,
        evidence: collectEvidence(notes),
      });
    } catch (error) {
      if (!(await repository.getDocumentByName(scope, name))) {
        throw error;
      }
    }
  }

  throw conflict();
}

export async function rememberNotesInScope(
  context: ServiceContext,
  scope: MemoryDocumentScopeKey,
  userId: number,
  notes: readonly MemoryNote[],
  operationId?: string,
): Promise<MemoryDocumentRow[]> {
  const documents = await context.repositories.get(MemoryDocumentRepository).listDocuments(scope);
  const written: MemoryDocumentRow[] = [];

  for (const [name, placed] of await placeMemories(context, documents, notes)) {
    written.push(
      await fileIntoDocument(context, scope, documents, name, userId, placed, operationId),
    );
  }

  return written;
}

export async function rememberInScope(
  context: ServiceContext,
  scope: MemoryDocumentScopeKey,
  userId: number,
  note: MemoryNote,
): Promise<MemoryDocumentRow> {
  const [written] = await rememberNotesInScope(context, scope, userId, [note], note.operationId);

  return written;
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
    const written = await saveNotes(context, current, [], userId, [note], note.operationId);

    if (written) {
      return written;
    }

    current = await repository.getDocumentById(document.id);
  }

  throw conflict();
}
