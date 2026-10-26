import {
  connectorOperationRequiresApproval,
  getConnectorOperationConfig,
  getConnectorProviderConfig,
  getKnowledgeConnectorDescriptor,
  isConnectorConnectionKindForAuth,
} from "@ngriffin_uk/polychat-ai-integrations";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { ownsResource, operationIsGranted } from "@ngriffin_uk/polychat-library-policy";
import {
  SOURCE_KNOWLEDGE_SYNC_TASK_TYPE,
  createConnectorKnowledgeSyncSchema,
  createFeedKnowledgeSyncSchema,
  createServiceKnowledgeSyncSchema,
  listPageOf,
  recipeConnectorProviderSchema,
  type CreateConnectorKnowledgeSync,
  type CreateFeedKnowledgeSync,
  type CreateServiceKnowledgeSync,
  type CreateKnowledgeSync,
  type KnowledgeSyncResource,
  type UpdateKnowledgeSync,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { Repositories } from "~/infrastructure/database/repositories";
import { ProviderConnectionRepository } from "~/modules/connectors/infrastructure/ProviderConnectionRepository";
import { requireKnowledgeTarget } from "~/modules/knowledge/application/intake/targets";
import { requirePublicFeedUrl } from "~/modules/knowledge/application/syncs/feeds";
import {
  formatKnowledgeSync,
  isConnectorKnowledgeSync,
  knowledgeSyncResourceOperations,
  parseKnowledgeSyncResources,
} from "~/modules/knowledge/application/syncs/record";
import type { KnowledgeTarget } from "~/modules/knowledge/domain/item";
import {
  KnowledgeSyncRepository,
  type ConnectorKnowledgeSyncRecord,
  type KnowledgeSyncRecord,
} from "~/modules/knowledge/infrastructure/KnowledgeSyncRepository";
import { requireNotebookAccess } from "~/modules/notebooks/application/access";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { getRecipeById } from "~/modules/recipes/application/catalog";
import { publishResourceEvent } from "~/modules/sync/application/resource-events";
import { requireProjectAccess } from "~/modules/workspaces/application/access";
import type { IEnv } from "~/types";

type ConnectorSyncAuthority = Pick<
  ConnectorKnowledgeSyncRecord,
  "user_id" | "project_id" | "collection_id" | "recipe_id" | "integration_id" | "connection_id"
>;

function notFound(): AssistantError {
  return new AssistantError("Knowledge sync not found", ErrorType.NOT_FOUND, 404);
}

export function requireKnowledgeSyncTarget(
  context: ServiceContext,
  sync: Pick<KnowledgeSyncRecord, "project_id" | "collection_id"> & {
    recipe_id: string | null;
  },
): Promise<KnowledgeTarget> {
  return requireKnowledgeTarget(
    context,
    { projectId: sync.project_id, notebookId: sync.collection_id },
    { manage: true, ...(sync.recipe_id ? { connectorRecipeId: sync.recipe_id } : {}) },
  );
}

export async function requireKnowledgeSyncAuthority(
  context: ServiceContext,
  sync: ConnectorSyncAuthority,
  resources: readonly KnowledgeSyncResource[],
) {
  const userId = context.requireUser().id;

  if (!ownsResource(userId, sync.user_id)) {
    throw notFound();
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

  for (const operation of resources.flatMap((resource) =>
    knowledgeSyncResourceOperations(resource, provider),
  )) {
    if (
      !operationIsGranted(integration.operationIds ?? [], operation) ||
      getConnectorOperationConfig(provider, operation)?.access !== "read" ||
      connectorOperationRequiresApproval(provider, operation)
    ) {
      throw new AssistantError(
        "Knowledge sync requires an authorised read operation",
        ErrorType.AUTHORISATION_ERROR,
        403,
      );
    }
  }

  await requireKnowledgeSyncTarget(context, sync);
  const connection = await context.repositories
    .get(ProviderConnectionRepository)
    .getConnectionById(sync.connection_id);

  const providerConfig = getConnectorProviderConfig(provider);

  if (
    !connection ||
    !providerConfig ||
    !ownsResource(userId, connection.user_id) ||
    connection.provider !== provider ||
    !isConnectorConnectionKindForAuth(connection.kind, providerConfig.auth.authType) ||
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

export function knowledgeSyncEventScope(sync: KnowledgeSyncRecord) {
  return sync.project_id
    ? { kind: "project" as const, projectId: sync.project_id }
    : { kind: "personal" as const, userId: sync.user_id };
}

export async function publishKnowledgeSyncChanged(
  context: ServiceContext,
  sync: KnowledgeSyncRecord,
): Promise<void> {
  await publishResourceEvent(
    context,
    knowledgeSyncEventScope(sync),
    "knowledge_sync.changed",
    sync.collection_id ? { notebookId: sync.collection_id } : {},
  );
}

export async function enqueueKnowledgeSync(
  env: IEnv,
  repositories: Repositories,
  sync: KnowledgeSyncRecord,
): Promise<void> {
  try {
    await new TaskService(env, repositories.get(TaskRepository)).enqueueTask({
      id: `knowledge_sync_${sync.id}_${sync.generation}_${sync.cursor}_${
        sync.checkpoint ? (await sha256Hex(sync.checkpoint)).slice(0, 12) : "start"
      }`,
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
      : await repository.listForLibrary(context.requireUser().id);

  return listPageOf(
    records.map((record) => formatKnowledgeSync(record, context.requireUser().id)),
    (sync) => sync.id,
  );
}

async function saveConnectorSync(
  context: ServiceContext,
  id: string,
  input: CreateConnectorKnowledgeSync,
): Promise<void> {
  const userId = context.requireUser().id;
  const { connection } = await requireKnowledgeSyncAuthority(
    context,
    {
      user_id: userId,
      project_id: input.projectId ?? null,
      collection_id: input.notebookId ?? null,
      recipe_id: input.recipeId,
      integration_id: input.integrationId,
      connection_id: input.connectionId,
    },
    input.resources,
  );

  for (const resource of input.resources) {
    const parameters =
      "descriptor" in resource ? resource.descriptor.parameters : resource.readParameters;

    if (JSON.stringify(redactSensitiveTokens(parameters)) !== JSON.stringify(parameters)) {
      throw new AssistantError(
        "Read parameters must not contain credentials",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  }

  await context.repositories.get(KnowledgeSyncRepository).create({
    id,
    userId,
    projectId: input.projectId ?? null,
    collectionId: input.notebookId ?? null,
    kind: "connector",
    connectionId: connection.id,
    recipeId: input.recipeId,
    integrationId: input.integrationId,
    title: input.title,
    resources: input.resources,
    intervalMinutes: input.intervalMinutes,
  });
}

async function saveFeedSync(
  context: ServiceContext,
  id: string,
  input: CreateFeedKnowledgeSync,
): Promise<void> {
  await requireKnowledgeSyncTarget(context, {
    project_id: input.projectId ?? null,
    collection_id: input.notebookId ?? null,
    recipe_id: null,
  });

  if (input.feed.kind === "rss") {
    requirePublicFeedUrl(input.feed.url);
  }

  await context.repositories.get(KnowledgeSyncRepository).create({
    id,
    userId: context.requireUser().id,
    projectId: input.projectId ?? null,
    collectionId: input.notebookId ?? null,
    kind: input.feed.kind,
    feed: input.feed,
    title: input.title,
    intervalMinutes: input.intervalMinutes,
  });
}

async function requireOwnedSync(context: ServiceContext, id: string): Promise<KnowledgeSyncRecord> {
  const sync = await context.repositories.get(KnowledgeSyncRepository).get(id);

  if (!sync || !ownsResource(context.requireUser().id, sync.user_id)) {
    throw notFound();
  }

  await requireKnowledgeSyncTarget(context, sync);

  return sync;
}

const KNOWLEDGE_RECIPE_ID = "project-knowledge";

async function resolveServiceSync(
  context: ServiceContext,
  input: CreateServiceKnowledgeSync,
): Promise<CreateConnectorKnowledgeSync> {
  const descriptor = getKnowledgeConnectorDescriptor(input.descriptor.id);

  if (!descriptor) {
    throw new AssistantError("Choose a document type to follow", ErrorType.PARAMS_ERROR, 400);
  }

  const provider = recipeConnectorProviderSchema.parse(descriptor.provider);
  const providerConfig = getConnectorProviderConfig(provider);
  const connection = (
    await context.repositories
      .get(ProviderConnectionRepository)
      .listConnections(context.requireUser().id, provider)
  ).find(
    (candidate) =>
      candidate.status === "connected" &&
      providerConfig !== undefined &&
      isConnectorConnectionKindForAuth(candidate.kind, providerConfig.auth.authType),
  );

  if (!connection) {
    throw new AssistantError(
      `Connect ${providerConfig?.name ?? descriptor.title} first, then follow it here`,
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  return createConnectorKnowledgeSyncSchema.parse({
    ...(input.projectId ? { projectId: input.projectId } : { notebookId: input.notebookId }),
    recipeId: KNOWLEDGE_RECIPE_ID,
    integrationId: provider,
    connectionId: connection.id,
    title: input.title,
    intervalMinutes: input.intervalMinutes,
    resources: [
      {
        resourceId: input.descriptor.id,
        title: input.title,
        descriptor: input.descriptor,
      },
    ],
  });
}

export async function createKnowledgeSync(context: ServiceContext, input: CreateKnowledgeSync) {
  const feed = createFeedKnowledgeSyncSchema.safeParse(input);
  const service = createServiceKnowledgeSyncSchema.safeParse(input);
  const id = generateId();

  if (feed.success) {
    await saveFeedSync(context, id, feed.data);
  } else {
    await saveConnectorSync(
      context,
      id,
      service.success
        ? await resolveServiceSync(context, service.data)
        : createConnectorKnowledgeSyncSchema.parse(input),
    );
  }

  const saved = await context.repositories.get(KnowledgeSyncRepository).get(id);

  if (!saved) {
    throw new AssistantError("Sync could not be saved", ErrorType.DATABASE_ERROR);
  }

  await enqueueKnowledgeSync(context.env, context.repositories, saved);
  await publishKnowledgeSyncChanged(context, saved);

  return formatKnowledgeSync(saved, context.requireUser().id);
}

export async function controlKnowledgeSync(
  context: ServiceContext,
  id: string,
  input: UpdateKnowledgeSync,
) {
  const sync = await requireOwnedSync(context, id);

  if (input.action !== "pause" && isConnectorKnowledgeSync(sync)) {
    await requireKnowledgeSyncAuthority(context, sync, parseKnowledgeSyncResources(sync));
  }

  await context.repositories.get(KnowledgeSyncRepository).control(id, input.action);
  const saved = await context.repositories.get(KnowledgeSyncRepository).get(id);

  if (!saved) {
    throw notFound();
  }

  if (input.action !== "pause") {
    await enqueueKnowledgeSync(context.env, context.repositories, saved);
  }

  await publishKnowledgeSyncChanged(context, saved);

  return formatKnowledgeSync(saved, context.requireUser().id);
}

export async function deleteKnowledgeSync(context: ServiceContext, id: string): Promise<void> {
  const sync = await requireOwnedSync(context, id);

  await context.repositories.get(KnowledgeSyncRepository).delete(id);
  await publishKnowledgeSyncChanged(context, sync);
}
