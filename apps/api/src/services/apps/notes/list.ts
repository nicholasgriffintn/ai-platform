import {
  deriveDocumentStatistics,
  type Note,
  type NoteCreateRequest,
  type NoteFormatResponse,
  type NoteUpdateRequest,
} from "@ngriffin_uk/polychat-schemas";

import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import type { OutputRecord } from "~/repositories/OutputRepository";
import { sanitiseInput } from "~/utils/sanitise";

const NOTE_OUTPUT_KIND = "note";

import { describeDocument, formatDocumentBody } from "~/services/documents";
import { requireOutputRecordAccess } from "~/services/outputs/access";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { isRecord } from "~/utils/objects";

import { safeParseJson } from "../../../utils/json";

function mapOutputToNote(entry: OutputRecord): Note {
  const data = safeParseJson<Record<string, unknown>>(entry.content) ?? {};

  return {
    id: entry.id,
    title: typeof data.title === "string" ? data.title : "",
    content: typeof data.content === "string" ? data.content : "",
    createdAt: entry.created_at,
    updatedAt: entry.updated_at ?? entry.created_at,
    metadata: isRecord(data.metadata) ? data.metadata : undefined,
  };
}

export async function listNotes({
  context,
  env,
  userId,
  projectId,
}: {
  context?: ServiceContext;
  env?: IEnv;
  userId: number;
  projectId?: string;
}): Promise<Note[]> {
  if (!userId) {
    throw new AssistantError("User ID is required", ErrorType.PARAMS_ERROR);
  }

  const serviceContext = resolveServiceContext({ context, env });

  serviceContext.ensureDatabase();
  const repo = serviceContext.repositories.outputs;
  const list = projectId
    ? await repo.listProjectOutputs(projectId, "notes", { kind: NOTE_OUTPUT_KIND })
    : await repo.listPersonalOutputs(userId, "notes", { kind: NOTE_OUTPUT_KIND });

  return list.map(mapOutputToNote);
}

export async function getNote({
  context,
  env,
  userId,
  noteId,
  projectId,
}: {
  context?: ServiceContext;
  env?: IEnv;
  userId: number;
  noteId: string;
  projectId?: string;
}): Promise<Note> {
  if (!userId || !noteId) {
    throw new AssistantError("Note ID and user ID are required", ErrorType.PARAMS_ERROR);
  }

  const serviceContext = resolveServiceContext({ context, env });

  serviceContext.ensureDatabase();
  const repo = serviceContext.repositories.outputs;
  const entry = projectId
    ? await repo.getProjectOutput(projectId, noteId)
    : await repo.getPersonalOutput(userId, noteId);

  if (!entry || entry.capability_id !== "notes" || entry.kind !== NOTE_OUTPUT_KIND) {
    throw new AssistantError("Note not found", ErrorType.NOT_FOUND, 404);
  }

  return mapOutputToNote(entry);
}

export async function createNote({
  context,
  env,
  user,
  data,
  projectId,
}: {
  context?: ServiceContext;
  env?: IEnv;
  user: IUser;
  data: NoteCreateRequest;
  projectId?: string;
}): Promise<Note> {
  if (!user?.id) {
    throw new AssistantError("User data required", ErrorType.PARAMS_ERROR);
  }

  const serviceContext = resolveServiceContext({ context, env, user });

  serviceContext.ensureDatabase();
  const repo = serviceContext.repositories.outputs;
  const noteId = generateId();

  const sanitisedTitle = sanitiseInput(data.title);
  const sanitisedContent = sanitiseInput(data.content);

  const generatedMetadata = await generateNoteMetadata(
    serviceContext,
    user,
    sanitisedTitle,
    sanitisedContent,
    data.metadata,
  );

  const appData = {
    title: sanitisedTitle,
    content: sanitisedContent,
    metadata: { ...generatedMetadata, ...data.metadata },
  };

  const entry = await repo.createOutput({
    id: noteId,
    createdByUserId: user.id,
    projectId,
    capabilityId: "notes",
    groupId: noteId,
    kind: NOTE_OUTPUT_KIND,
    title: sanitisedTitle,
    content: appData,
  });

  return mapOutputToNote(entry);
}

export async function updateNote({
  context,
  env,
  user,
  noteId,
  data,
  projectId,
}: {
  context?: ServiceContext;
  env?: IEnv;
  user: IUser;
  noteId: string;
  data: NoteUpdateRequest;
  projectId?: string;
}): Promise<Note> {
  if (!user?.id || !noteId) {
    throw new AssistantError("Note ID and user ID are required", ErrorType.PARAMS_ERROR);
  }

  const serviceContext = resolveServiceContext({ context, env, user });

  serviceContext.ensureDatabase();
  const repo = serviceContext.repositories.outputs;
  const existing = projectId
    ? await repo.getProjectOutput(projectId, noteId)
    : await repo.getPersonalOutput(user.id, noteId);

  if (!existing || existing.capability_id !== "notes" || existing.kind !== NOTE_OUTPUT_KIND) {
    throw new AssistantError("Note not found", ErrorType.NOT_FOUND, 404);
  }

  await requireOutputRecordAccess(serviceContext, user.id, existing, true);

  const parsedExistingData = safeParseJson<Record<string, unknown>>(existing.content) ?? {};
  const existingMetadata = isRecord(parsedExistingData.metadata) ? parsedExistingData.metadata : {};

  const sanitisedTitle = sanitiseInput(data.title);
  const sanitisedContent = sanitiseInput(data.content);

  const incomingMetadata = isRecord(data.metadata) ? data.metadata : {};
  const hasExistingMetadata = Object.keys(existingMetadata).length > 0;
  const shouldRedescribe = data.options?.refreshMetadata === true || !hasExistingMetadata;
  const carried = { ...existingMetadata, ...incomingMetadata };
  const mergedMetadata = {
    ...(shouldRedescribe
      ? await generateNoteMetadata(serviceContext, user, sanitisedTitle, sanitisedContent, carried)
      : carried),
    ...deriveDocumentStatistics(sanitisedContent),
  };

  const finalData = {
    title: sanitisedTitle,
    content: sanitisedContent,
    metadata: mergedMetadata,
  };

  const updated = await repo.updateOutput(noteId, {
    title: sanitisedTitle,
    content: finalData,
    expectedRevision: existing.revision,
    updatedByUserId: user.id,
  });

  return mapOutputToNote(updated);
}

export async function deleteNote({
  context,
  env,
  user,
  noteId,
  projectId,
}: {
  context?: ServiceContext;
  env?: IEnv;
  user: IUser;
  noteId: string;
  projectId?: string;
}): Promise<void> {
  if (!user?.id || !noteId) {
    throw new AssistantError("Note ID and user ID are required", ErrorType.PARAMS_ERROR);
  }

  const serviceContext = resolveServiceContext({ context, env, user });

  serviceContext.ensureDatabase();
  const repo = serviceContext.repositories.outputs;
  const existing = projectId
    ? await repo.getProjectOutput(projectId, noteId)
    : await repo.getPersonalOutput(user.id, noteId);

  if (!existing || existing.capability_id !== "notes" || existing.kind !== NOTE_OUTPUT_KIND) {
    throw new AssistantError("Note not found", ErrorType.NOT_FOUND, 404);
  }

  await requireOutputRecordAccess(serviceContext, user.id, existing, true);

  await repo.deleteOutput(noteId);
}

export async function formatNote({
  context,
  env,
  user,
  noteId,
  prompt,
  projectId,
}: {
  context?: ServiceContext;
  env?: IEnv;
  user: IUser;
  noteId: string;
  prompt?: string;
  projectId?: string;
}): Promise<NoteFormatResponse> {
  const serviceContext = resolveServiceContext({ context, env, user });

  serviceContext.ensureDatabase();

  const note = await getNote({ context: serviceContext, userId: user.id, noteId, projectId });

  return {
    content: await formatDocumentBody({
      context: serviceContext,
      user,
      body: note.content,
      prompt,
    }),
  };
}

async function generateNoteMetadata(
  context: ServiceContext,
  user: IUser,
  title: string,
  content: string,
  existingMetadata?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return describeDocument({ context, user, title, body: content, existing: existingMetadata });
}
