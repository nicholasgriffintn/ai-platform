import { RepositoryManager } from "~/repositories";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export async function listNotes({
  env,
  userId,
}: { env: IEnv; userId: number }): Promise<Note[]> {
  if (!userId) {
    throw new AssistantError("User ID is required", ErrorType.PARAMS_ERROR);
  }

  const repo = RepositoryManager.getInstance(env).appData;
  const list = await repo.getAppDataByUserAndApp(userId, "notes");

  return list.map((entry) => {
    const data = JSON.parse(entry.data);
    return {
      id: entry.id,
      title: data.title,
      content: data.content,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
      metadata: data.metadata,
    };
  });
}

export async function getNote({
  env,
  userId,
  noteId,
}: { env: IEnv; userId: number; noteId: string }): Promise<Note> {
  if (!userId || !noteId) {
    throw new AssistantError(
      "Note ID and user ID are required",
      ErrorType.PARAMS_ERROR,
    );
  }

  const repo = RepositoryManager.getInstance(env).appData;
  const entry = await repo.getAppDataById(noteId);

  if (!entry || entry.user_id !== userId || entry.app_id !== "notes") {
    throw new AssistantError("Note not found", ErrorType.NOT_FOUND);
  }

  const data = JSON.parse(entry.data);

  return {
    id: entry.id,
    title: data.title,
    content: data.content,
    createdAt: entry.created_at,
    updatedAt: entry.updated_at,
    metadata: data.metadata,
  };
}

export async function createNote({
  env,
  user,
  data,
}: {
  env: IEnv;
  user: IUser;
  data: { title: string; content: string; metadata?: Record<string, any> };
}): Promise<Note> {
  if (!user?.id) {
    throw new AssistantError("User data required", ErrorType.PARAMS_ERROR);
  }
  const repo = RepositoryManager.getInstance(env).appData;
  const noteId = generateId();
  const entry = await repo.createAppDataWithItem(
    user.id,
    "notes",
    noteId,
    "note",
    data,
  );

  const full = await repo.getAppDataById(entry.id);
  const parsed = JSON.parse(full!.data);

  return {
    id: full!.id,
    title: parsed.title,
    content: parsed.content,
    createdAt: full!.created_at,
    updatedAt: full!.updated_at,
    metadata: parsed.metadata,
  };
}

export async function updateNote({
  env,
  userId,
  noteId,
  data,
}: {
  env: IEnv;
  userId: number;
  noteId: string;
  data: { title: string; content: string; metadata?: Record<string, any> };
}): Promise<Note> {
  if (!userId || !noteId) {
    throw new AssistantError(
      "Note ID and user ID are required",
      ErrorType.PARAMS_ERROR,
    );
  }

  const repo = RepositoryManager.getInstance(env).appData;
  const existing = await repo.getAppDataById(noteId);

  if (!existing || existing.user_id !== userId || existing.app_id !== "notes") {
    throw new AssistantError("Note not found", ErrorType.NOT_FOUND);
  }

  await repo.updateAppData(noteId, data);
  const updated = await repo.getAppDataById(noteId);
  const parsed = JSON.parse(updated!.data);

  return {
    id: updated!.id,
    title: parsed.title,
    content: parsed.content,
    createdAt: updated!.created_at,
    updatedAt: updated!.updated_at,
    metadata: parsed.metadata,
  };
}

export async function deleteNote({
  env,
  userId,
  noteId,
}: { env: IEnv; userId: number; noteId: string }): Promise<void> {
  if (!userId || !noteId) {
    throw new AssistantError(
      "Note ID and user ID are required",
      ErrorType.PARAMS_ERROR,
    );
  }

  const repo = RepositoryManager.getInstance(env).appData;
  const existing = await repo.getAppDataById(noteId);

  if (!existing || existing.user_id !== userId || existing.app_id !== "notes") {
    throw new AssistantError("Note not found", ErrorType.NOT_FOUND);
  }

  await repo.deleteAppData(noteId);
}
