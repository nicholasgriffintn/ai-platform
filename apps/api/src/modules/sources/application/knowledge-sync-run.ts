import { normaliseConnectorKnowledge } from "@ngriffin_uk/polychat-ai-integrations";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { closeComposioConnectorRun } from "~/modules/apps/application/connectors/composio-run";
import { executeRecipeConnectorOperation } from "~/modules/apps/application/connectors/operations";
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
          projectId: sync.project_id,
          recipeId: sync.recipe_id,
        },
      });
    } catch (error) {
      if (error instanceof AssistantError && [403, 404].includes(error.statusCode)) {
        await requireKnowledgeSyncAuthority(context, sync, [resource]);
        await context.repositories.knowledgeSyncs.markUnavailable(sync, token, sourceId);
      }

      throw error;
    }

    const document = normaliseConnectorKnowledge(result, resource);

    await requireKnowledgeSyncAuthority(context, sync, [resource]);
    if (
      !(await context.repositories.knowledgeSyncs.commitResource(sync, token, {
        ...document,
        sourceId,
        resourceId: resource.resourceId,
        resourceCount: resources.length,
        provider,
      }))
    ) {
      return;
    }

    const latest = await context.repositories.knowledgeSyncs.get(sync.id);

    if (!latest || latest.generation !== initial.generation) {
      return;
    }

    sync = latest;
  }
}

export async function runKnowledgeSync(env: IEnv, id: string, userId: number, generation: number) {
  const repositories = RepositoryManager.getInstance(env);
  const sync = await repositories.knowledgeSyncs.get(id);

  if (
    !sync ||
    sync.user_id !== userId ||
    sync.generation !== generation ||
    sync.status !== "active"
  ) {
    return;
  }

  const user = await repositories.users.getUserById(userId);

  if (!user) {
    return;
  }

  const token = generateId();

  if (!(await repositories.knowledgeSyncs.claim(id, generation, token))) {
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
      await repositories.knowledgeSyncs.release(id, token, errorMessage, pause);
    } finally {
      await closeComposioConnectorRun(context);
    }
  }
}

export async function scheduleKnowledgeSyncs(env: IEnv): Promise<number> {
  const repositories = RepositoryManager.getInstance(env);
  const syncs = await repositories.knowledgeSyncs.due();

  for (const sync of syncs) {
    await enqueueKnowledgeSync(env, repositories, sync);
  }

  return syncs.length;
}
