import { normaliseConnectorKnowledge } from "@ngriffin_uk/polychat-ai-integrations";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { createRepositories } from "~/infrastructure/database/repositories";
import { closeComposioConnectorRun } from "~/modules/connectors/application/composio-run";
import { executeRecipeConnectorOperation } from "~/modules/connectors/application/operations";
import { KnowledgeSyncRepository } from "~/modules/sources/infrastructure/KnowledgeSyncRepository";
import { publishResourceEvent } from "~/modules/sync/application/resource-events";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import type { IEnv } from "~/types";

import type { KnowledgeSyncRecord } from "../infrastructure/KnowledgeSyncRepository";
import { requireKnowledgeSyncAuthority, enqueueKnowledgeSync } from "./knowledge-sync";
import { parseKnowledgeSyncResources } from "./knowledge-sync-record";

async function syncResources(context: ServiceContext, initial: KnowledgeSyncRecord, token: string) {
  const resources = parseKnowledgeSyncResources(initial);
  let sync = initial;

  for (let count = 0; count < 10; count++) {
    const resource = resources[sync.cursor];

    if (!resource) {
      throw new AssistantError(
        "Knowledge sync checkpoint is invalid",
        ErrorType.CONFIGURATION_ERROR,
        409,
      );
    }

    const { connection, provider } = await requireKnowledgeSyncAuthority(context, sync, [resource]);
    const sourceId = "source_sync_" + (await sha256Hex(sync.id + ":" + resource.resourceId));
    let result: unknown;

    try {
      result = await executeRecipeConnectorOperation({
        context,
        userId: sync.user_id,
        request: {
          provider,
          operation: resource.operation,
          connectedAccountId: connection.external_id,
          params: resource.readParameters,
        },
        scope: {
          completionId: context.connectorRunId,
          conversationId: null,
          projectId: sync.project_id,
          recipeId: sync.recipe_id,
        },
      });
    } catch (error) {
      if (error instanceof AssistantError && [403, 404].includes(error.statusCode)) {
        await requireKnowledgeSyncAuthority(context, sync, [resource]);
        await context.repositories
          .get(KnowledgeSyncRepository)
          .markUnavailable(sync, token, sourceId);
      }

      throw error;
    }

    const document = normaliseConnectorKnowledge(result, resource);

    await requireKnowledgeSyncAuthority(context, sync, [resource]);
    if (
      !(await context.repositories.get(KnowledgeSyncRepository).commitResource(sync, token, {
        ...document,
        sourceId,
        resourceId: resource.resourceId,
        resourceCount: resources.length,
        provider,
      }))
    ) {
      return;
    }

    await publishResourceEvent(
      context,
      sync.project_id
        ? { kind: "project", projectId: sync.project_id }
        : { kind: "personal", userId: sync.user_id },
      "knowledge_sync.changed",
      sync.collection_id ? { notebookId: sync.collection_id } : {},
    );
    const latest = await context.repositories.get(KnowledgeSyncRepository).get(sync.id);

    if (!latest || latest.generation !== initial.generation) {
      return;
    }

    sync = latest;
  }
}

export async function runKnowledgeSync(env: IEnv, id: string, userId: number, generation: number) {
  const knowledgeSyncs = new KnowledgeSyncRepository(env);
  const sync = await knowledgeSyncs.get(id);

  if (
    !sync ||
    sync.user_id !== userId ||
    sync.generation !== generation ||
    sync.status !== "active"
  ) {
    return;
  }

  const user = await new UserRepository(env).getUserById(userId);

  if (!user) {
    return;
  }

  const token = generateId();

  if (!(await knowledgeSyncs.claim(id, generation, token))) {
    return;
  }

  let errorMessage: string | null = null;
  let pause = false;
  const context = createServiceContext({ env, user });

  try {
    await syncResources(context, sync, token);
  } catch (error) {
    pause = error instanceof AssistantError && [401, 403, 404].includes(error.statusCode);
    errorMessage = pause
      ? "Sync paused. Check project access and reconnect the source account. The checkpoint was retained."
      : "Sync failed. The checkpoint was retained for retry.";
    throw new AssistantError(errorMessage, ErrorType.PROVIDER_ERROR, 502);
  } finally {
    try {
      await knowledgeSyncs.release(id, token, errorMessage, pause);
      await publishResourceEvent(
        context,
        sync.project_id
          ? { kind: "project", projectId: sync.project_id }
          : { kind: "personal", userId: sync.user_id },
        "knowledge_sync.changed",
        sync.collection_id ? { notebookId: sync.collection_id } : {},
      );
    } finally {
      await closeComposioConnectorRun(context);
    }
  }
}

export async function scheduleKnowledgeSyncs(env: IEnv): Promise<number> {
  const repositories = createRepositories(env);
  const syncs = await repositories.get(KnowledgeSyncRepository).due();

  for (const sync of syncs) {
    await enqueueKnowledgeSync(env, repositories, sync);
  }

  return syncs.length;
}
