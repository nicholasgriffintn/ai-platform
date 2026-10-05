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
  recipeConnectorProviderSchema,
  type CreateKnowledgeSync,
  type KnowledgeSyncResource,
  type UpdateKnowledgeSync,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { getRecipeById } from "~/modules/apps/application/recipes/catalog";
import { TaskService } from "~/modules/tasks/application/TaskService";
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
    "user_id" | "project_id" | "recipe_id" | "integration_id" | "connection_id"
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

  await requireProjectAccess(context, sync.project_id, ["owner", "admin"]);
  await requireProjectCapabilityAccess(context, sync.project_id, "recipe", recipe.id);
  const connection = await context.repositories.providerConnections.getConnectionById(
    sync.connection_id,
  );

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

export async function enqueueKnowledgeSync(
  env: IEnv,
  repositories: RepositoryManager,
  sync: KnowledgeSyncRecord,
): Promise<void> {
  try {
    await new TaskService(env, repositories.tasks).enqueueTask({
      id: `knowledge_sync_${sync.id}_${sync.generation}_${sync.cursor}`,
      task_type: SOURCE_KNOWLEDGE_SYNC_TASK_TYPE,
      user_id: sync.user_id,
      project_id: sync.project_id,
      task_data: { syncId: sync.id, generation: sync.generation },
    });
  } catch {
    getLogger({ prefix: "knowledge-sync" }).warn("Knowledge sync saved for queue recovery", {
      syncId: sync.id,
    });
  }
}

export async function listKnowledgeSyncs(context: ServiceContext, projectId: string) {
  await requireProjectAccess(context, projectId);
  const records = await context.repositories.knowledgeSyncs.list(projectId);

  return { syncs: records.map((record) => formatKnowledgeSync(record, context.requireUser().id)) };
}

export async function createKnowledgeSync(context: ServiceContext, input: CreateKnowledgeSync) {
  const parsed = createKnowledgeSyncSchema.parse(input);
  const userId = context.requireUser().id;

  const { connection } = await requireKnowledgeSyncAuthority(
    context,
    {
      user_id: userId,
      project_id: parsed.projectId,
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

  await context.repositories.knowledgeSyncs.create({
    id,
    userId,
    projectId: parsed.projectId,
    connectionId: connection.id,
    recipeId: parsed.recipeId,
    integrationId: parsed.integrationId,
    title: parsed.title,
    resources: parsed.resources,
    intervalMinutes: parsed.intervalMinutes,
  });
  const saved = await context.repositories.knowledgeSyncs.get(id);

  if (!saved) {
    throw new AssistantError("Sync could not be saved", ErrorType.DATABASE_ERROR);
  }

  await enqueueKnowledgeSync(context.env, context.repositories, saved);

  return formatKnowledgeSync(saved, userId);
}

export async function controlKnowledgeSync(
  context: ServiceContext,
  id: string,
  input: UpdateKnowledgeSync,
) {
  const sync = await context.repositories.knowledgeSyncs.get(id);

  if (!sync || !ownsResource(context.requireUser().id, sync.user_id)) {
    throw new AssistantError("Knowledge sync not found", ErrorType.NOT_FOUND, 404);
  }

  await requireProjectAccess(context, sync.project_id);
  if (input.action !== "pause") {
    await requireKnowledgeSyncAuthority(context, sync, parseKnowledgeSyncResources(sync));
  }

  await context.repositories.knowledgeSyncs.control(id, input.action);
  const saved = await context.repositories.knowledgeSyncs.get(id);

  if (!saved) {
    throw new AssistantError("Knowledge sync not found", ErrorType.NOT_FOUND, 404);
  }

  if (input.action !== "pause") {
    await enqueueKnowledgeSync(context.env, context.repositories, saved);
  }

  return formatKnowledgeSync(saved, context.requireUser().id);
}
