import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";
import {
  MEMORY_IMPORT_TASK_TYPE,
  memoryImportExtractionSchema,
  type CreateMemoryImportInput,
  type MemoryImportResponse,
  type MemoryImportTaskData,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { MemoryDocumentRow } from "~/infrastructure/database/schema";
import { generateSystemObject } from "~/modules/models/application/system-object";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { getRequestUserSettings } from "~/modules/user/application/request-settings";
import type { IEnv } from "~/types";

import {
  batchMemoryImport,
  importedMemoryNotes,
  packMemoryImport,
  readMemoryImportBatch,
  renderMemoryImportBatch,
} from "./import-batches";
import { rememberNotesInScope } from "./remember";

function memoryImportPrefix(userId: number): string {
  return `memory/imports/${userId}/`;
}

function requireImportBucket(env: IEnv): R2Bucket {
  if (!env.PRIVATE_ASSETS_BUCKET) {
    throw new AssistantError(
      "Memory import needs private storage, which is not configured",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return env.PRIVATE_ASSETS_BUCKET;
}

export function enqueueMemoryImportBatch(
  env: IEnv,
  userId: number,
  data: MemoryImportTaskData,
): Promise<string> {
  return new TaskService(env, new TaskRepository(env)).enqueueTask({
    id: `memory_import_${data.importId}_${data.batch}`,
    task_type: MEMORY_IMPORT_TASK_TYPE,
    user_id: userId,
    task_data: data,
    priority: 7,
  });
}

export async function startMemoryImport(
  context: ServiceContext,
  input: CreateMemoryImportInput,
): Promise<MemoryImportResponse> {
  const user = context.requireUser();
  const bucket = requireImportBucket(context.env);
  const settings = await getRequestUserSettings(context);

  if (settings?.memory_provider && settings.memory_provider !== "documents") {
    throw new AssistantError(
      "Imported memories are filed as memory documents. Switch memory to documents to bring them over.",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const { batches, messages } = batchMemoryImport(input);

  if (batches.length === 0) {
    throw new AssistantError(
      "Nothing in this import reads as something you wrote",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const importId = generateId();
  const key = `${memoryImportPrefix(user.id)}${importId}.json`;
  const { body, offsets } = packMemoryImport(batches);

  await bucket.put(key, body, { httpMetadata: { contentType: "application/json" } });

  const taskId = await enqueueMemoryImportBatch(context.env, user.id, {
    importId,
    source: input.kind === "summary" ? "summary" : input.source,
    key,
    offsets,
    batch: 0,
  });

  return {
    importId,
    taskId,
    conversations: input.kind === "summary" ? 0 : input.conversations.length,
    messages,
  };
}

export async function importMemoryBatch(
  context: ServiceContext,
  data: MemoryImportTaskData,
): Promise<{ remembered: number; documents: MemoryDocumentRow[] }> {
  const user = context.requireUser();
  const start = data.offsets[data.batch];
  const end = data.offsets[data.batch + 1];

  if (
    !data.key.startsWith(memoryImportPrefix(user.id)) ||
    start === undefined ||
    end === undefined
  ) {
    throw new AssistantError("This import part does not belong to you", ErrorType.FORBIDDEN, 403);
  }

  const object = await requireImportBucket(context.env).get(data.key, {
    range: { offset: start, length: end - start },
  });

  if (!object) {
    return { remembered: 0, documents: [] };
  }

  const batch = readMemoryImportBatch(await object.text());

  if (batch.length === 0) {
    return { remembered: 0, documents: [] };
  }

  const extraction = await generateSystemObject(context, {
    role: "housekeeping",
    name: "memory_import",
    schema: memoryImportExtractionSchema,
    system: getPromptText("memory/import"),
    material: `## Messages\n\n${renderMemoryImportBatch(batch)}`,
  });
  const notes = importedMemoryNotes(extraction, batch, data.source);

  if (notes.length === 0) {
    return { remembered: 0, documents: [] };
  }

  const documents = await rememberNotesInScope(
    context,
    { scopeType: "personal", scopeId: String(user.id) },
    user.id,
    notes,
    `memory-import:${data.importId}:${data.batch}`,
  );

  return { remembered: notes.length, documents };
}

export async function advanceMemoryImport(
  env: IEnv,
  userId: number,
  data: MemoryImportTaskData,
): Promise<void> {
  if (data.batch + 2 < data.offsets.length) {
    await enqueueMemoryImportBatch(env, userId, { ...data, batch: data.batch + 1 });

    return;
  }

  if (data.key.startsWith(memoryImportPrefix(userId))) {
    await env.PRIVATE_ASSETS_BUCKET?.delete(data.key);
  }
}
