import {
  CONNECTOR_ACCOUNT_REFERENCE_KIND,
  connectorOperationRequiresApproval,
  getConnectorOperationConfig,
} from "@ngriffin_uk/polychat-ai-integrations";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { ownsResource, operationIsGranted } from "@ngriffin_uk/polychat-library-policy";
import {
  SOURCE_KNOWLEDGE_SYNC_TASK_TYPE,
  createKnowledgeSyncSchema,
  listPageOf,
  recipeConnectorProviderSchema,
  type CreateKnowledgeSync,
  type KnowledgeSyncResource,
  type UpdateKnowledgeSync,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { Repositories } from "~/infrastructure/database/repositories";
import { ProviderConnectionRepository } from "~/modules/connectors/infrastructure/ProviderConnectionRepository";
import { requireNotebookAccess } from "~/modules/notebooks/application/access";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { getRecipeById } from "~/modules/recipes/application/catalog";
import { KnowledgeSyncRepository } from "~/modules/sources/infrastructure/KnowledgeSyncRepository";
import { publishResourceEvent } from "~/modules/sync/application/resource-events";
import {
  requireProjectAccess,
  requireProjectCapabilityAccess,
} from "~/modules/workspaces/application/access";
import type { IEnv } from "~/types";

import type { KnowledgeSyncRecord } from "../infrastructure/KnowledgeSyncRepository";
import { formatKnowledgeSync, parseKnowledgeSyncResources } from "./knowledge-sync-record";

export async function requireKnowledgeSyncAuthority(
  context: ServiceContext,
  sync: Pick<
    KnowledgeSyncRecord,
    "user_id" | "project_id" | "collection_id" | "recipe_id" | "integration_id" | "connection_id"
  >,
  resources: readonly KnowledgeSyncResource[],
) {
  const userId = context.requireUser().id;

  if (!ownsResource(userId, sync.user_id)) {
    throw new AssistantError("Knowledge sync not found", ErrorType.NOT_FOUND, 404);
  }

  const recipe = getRecipeById(sync.recipe_id);
  const integration = recipe?.integrations.find((entry) => entry.id === sync.integration_id);

  if (!recipe || !integration) {
    throw new AssistantError(
      "This recipe integration cannot sync knowledge",
      ErrorType.CONFIGURATION_ERROR,
      400,
    );
  }

  const provider = recipeConnectorProviderSchema.parse(integration.providerId);

  for (const resource of resources) {
    if (
      !operationIsGranted(integration.operationIds ?? [], resource.operation) ||
      getConnectorOperationConfig(provider, resource.operation)?.access !== "read" ||
      connectorOperationRequiresApproval(provider, resource.operation)
    ) {
      throw new AssistantError(
        "Knowledge sync requires an authorised read operation",
        ErrorType.AUTHORISATION_ERROR,
        403,
      );
    }
  }

  await requireSyncTargetAccess(context, sync, recipe.id);
  const connection = await context.repositories
    .get(ProviderConnectionRepository)
    .getConnectionById(sync.connection_id);

  if (
    !connection ||
    !ownsResource(userId, connection.user_id) ||
    connection.provider !== provider ||
    connection.kind !== CONNECTOR_ACCOUNT_REFERENCE_KIND ||
    connection.status !== "connected"
  ) {
    throw new AssistantError(
      "Reconnect the account used by this sync",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  return { connection, provider };
}

async function requireSyncTargetAccess(
  context: ServiceContext,
  sync: Pick<KnowledgeSyncRecord, "project_id" | "collection_id">,
  recipeId: string,
): Promise<void> {
  if (sync.project_id) {
    await requireProjectAccess(context, sync.project_id, ["owner", "admin"]);
    await requireProjectCapabilityAccess(context, sync.project_id, "recipe", recipeId);

    return;
  }

  const notebook = sync.collection_id
    ? await requireNotebookAccess(context, sync.collection_id, { manage: true })
    : null;

  if (!notebook || notebook.notebook.project_id) {
    throw new AssistantError("Knowledge sync not found", ErrorType.NOT_FOUND, 404);
  }
}

function syncEventScope(sync: KnowledgeSyncRecord) {
  return sync.project_id
    ? { kind: "project" as const, projectId: sync.project_id }
    : { kind: "personal" as const, userId: sync.user_id };
}

export async function enqueueKnowledgeSync(
  env: IEnv,
  repositories: Repositories,
  sync: KnowledgeSyncRecord,
): Promise<void> {
  try {
    await new TaskService(env, repositories.get(TaskRepository)).enqueueTask({
      id: `knowledge_sync_${sync.id}_${sync.generation}_${sync.cursor}`,
      task_type: SOURCE_KNOWLEDGE_SYNC_TASK_TYPE,
      user_id: sync.user_id,
      project_id: sync.project_id ?? undefined,
      task_data: { syncId: sync.id, generation: sync.generation },
    });
  } catch {
    getLogger({ prefix: "knowledge-sync" }).warn("Knowledge sync saved for queue recovery", {
      syncId: sync.id,
    });
  }
}

export async function listKnowledgeSyncs(
  context: ServiceContext,
  target: { projectId?: string; notebookId?: string },
) {
  const repository = context.repositories.get(KnowledgeSyncRepository);
  const records = target.projectId
    ? (await requireProjectAccess(context, target.projectId),
      await repository.list(target.projectId))
    : target.notebookId
      ? (await requireNotebookAccess(context, target.notebookId),
        await repository.listForCollection(target.notebookId))
      : [];

  return listPageOf(
    records.map((record) => formatKnowledgeSync(record, context.requireUser().id)),
    (sync) => sync.id,
  );
}

export async function createKnowledgeSync(context: ServiceContext, input: CreateKnowledgeSync) {
  const parsed = createKnowledgeSyncSchema.parse(input);
  const userId = context.requireUser().id;

  const { connection } = await requireKnowledgeSyncAuthority(
    context,
    {
      user_id: userId,
      project_id: parsed.projectId ?? null,
      collection_id: parsed.notebookId ?? null,
      recipe_id: parsed.recipeId,
      integration_id: parsed.integrationId,
      connection_id: parsed.connectionId,
    },
    parsed.resources,
  );

  for (const resource of parsed.resources) {
    if (
      JSON.stringify(redactSensitiveTokens(resource.readParameters)) !==
      JSON.stringify(resource.readParameters)
    ) {
      throw new AssistantError(
        "Read parameters must not contain credentials",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  }

  const id = generateId();

  await context.repositories.get(KnowledgeSyncRepository).create({
    id,
    userId,
    projectId: parsed.projectId ?? null,
    collectionId: parsed.notebookId ?? null,
    connectionId: connection.id,
    recipeId: parsed.recipeId,
    integrationId: parsed.integrationId,
    title: parsed.title,
    resources: parsed.resources,
    intervalMinutes: parsed.intervalMinutes,
  });
  const saved = await context.repositories.get(KnowledgeSyncRepository).get(id);

  if (!saved) {
    throw new AssistantError("Sync could not be saved", ErrorType.DATABASE_ERROR);
  }

  await enqueueKnowledgeSync(context.env, context.repositories, saved);

  await publishResourceEvent(
    context,
    syncEventScope(saved),
    "knowledge_sync.changed",
    saved.collection_id ? { notebookId: saved.collection_id } : {},
  );

  return formatKnowledgeSync(saved, userId);
}

export async function controlKnowledgeSync(
  context: ServiceContext,
  id: string,
  input: UpdateKnowledgeSync,
) {
  const sync = await context.repositories.get(KnowledgeSyncRepository).get(id);

  if (!sync || !ownsResource(context.requireUser().id, sync.user_id)) {
    throw new AssistantError("Knowledge sync not found", ErrorType.NOT_FOUND, 404);
  }

  await requireSyncTargetAccess(context, sync, sync.recipe_id);
  if (input.action !== "pause") {
    await requireKnowledgeSyncAuthority(context, sync, parseKnowledgeSyncResources(sync));
  }

  await context.repositories.get(KnowledgeSyncRepository).control(id, input.action);
  const saved = await context.repositories.get(KnowledgeSyncRepository).get(id);

  if (!saved) {
    throw new AssistantError("Knowledge sync not found", ErrorType.NOT_FOUND, 404);
  }

  if (input.action !== "pause") {
    await enqueueKnowledgeSync(context.env, context.repositories, saved);
  }

  await publishResourceEvent(
    context,
    syncEventScope(saved),
    "knowledge_sync.changed",
    saved.collection_id ? { notebookId: saved.collection_id } : {},
  );

  return formatKnowledgeSync(saved, context.requireUser().id);
}
