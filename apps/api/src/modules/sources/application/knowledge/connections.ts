import { authorise } from "@ngriffin_uk/polychat-library-policy";
import {
  KNOWLEDGE_SYNC_TASK_TYPE,
  type CreateKnowledgeSync,
  type KnowledgeSyncControl,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { TaskService } from "~/modules/tasks/application/TaskService";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { createGitHubKnowledgeReader } from "./github-reader";
import { formatKnowledgeSync } from "./presentation";

async function requireManagedSync(context: ServiceContext, id: string) {
  const user = context.requireUser();
  const record = await context.repositories.knowledgeSyncs.get(id);

  if (
    !record ||
    !authorise("owner.access", {
      actorId: String(user.id),
      ownerId: String(record.created_by_user_id),
    }).allowed
  ) {
    throw new AssistantError("Knowledge connection not found", ErrorType.NOT_FOUND, 404);
  }

  if (record.project_id) {
    await requireProjectAccess(context, record.project_id, ["owner", "admin"]);
  }

  return record;
}

export async function listKnowledgeSyncs(context: ServiceContext, projectId?: string) {
  const user = context.requireUser();

  if (projectId) {
    await requireProjectAccess(context, projectId);
  }

  const records = await context.repositories.knowledgeSyncs.list(user.id, projectId);

  return { syncs: records.map(formatKnowledgeSync) };
}

export async function createKnowledgeSync(context: ServiceContext, input: CreateKnowledgeSync) {
  const user = context.requireUser();

  if (input.projectId) {
    await requireProjectAccess(context, input.projectId, ["owner", "admin"]);
  }

  const reader = await createGitHubKnowledgeReader(
    context,
    user.id,
    input.repository,
    input.installationId,
  );

  if (input.projectId) {
    await reader.assertPublic();
  }

  await reader.commit(input.branch);
  await reader.assertCurrentAccess();
  const id = generateId();

  await context.repositories.knowledgeSyncs.create({
    id,
    created_by_user_id: user.id,
    project_id: input.projectId ?? null,
    repository: input.repository,
    branch: input.branch,
    path: input.path,
    installation_id: input.installationId,
    status: "idle",
    revision: 1,
    next_sync_at: Date.now(),
  });
  await enqueueKnowledgeSync(context, id, user.id);

  const created = await context.repositories.knowledgeSyncs.get(id);

  if (!created) {
    throw new AssistantError("Knowledge connection not found", ErrorType.NOT_FOUND, 404);
  }

  return formatKnowledgeSync(created);
}

export async function controlKnowledgeSync(
  context: ServiceContext,
  id: string,
  input: KnowledgeSyncControl,
) {
  const record = await requireManagedSync(context, id);

  if (record.revision !== input.revision) {
    throw new AssistantError(
      "Knowledge connection changed. Refresh and try again.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  await context.repositories.knowledgeSyncs.control(record, context.requireUser().id, input.action);

  if (input.action !== "pause") {
    await enqueueKnowledgeSync(context, id, record.created_by_user_id);
  }

  const updated = await context.repositories.knowledgeSyncs.get(id);

  if (!updated) {
    throw new AssistantError("Knowledge connection not found", ErrorType.NOT_FOUND, 404);
  }

  return formatKnowledgeSync(updated);
}

export async function deleteKnowledgeSync(context: ServiceContext, id: string) {
  const record = await requireManagedSync(context, id);

  await context.repositories.knowledgeSyncs.remove(record, context.requireUser().id);
}

export function enqueueKnowledgeSync(context: ServiceContext, syncId: string, userId: number) {
  return new TaskService(context.env, context.repositories.tasks).enqueueTask({
    id: `knowledge_${syncId}_${Math.floor(Date.now() / 60_000)}`,
    task_type: KNOWLEDGE_SYNC_TASK_TYPE,
    user_id: userId,
    task_data: { syncId },
    priority: 4,
  });
}
