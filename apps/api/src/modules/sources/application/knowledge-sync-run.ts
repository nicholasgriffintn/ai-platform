import {
  CONFLUENCE_KNOWLEDGE_RECIPE_ID,
  CONFLUENCE_PAGE_READ_OPERATION,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { closeComposioConnectorRun } from "~/modules/apps/application/connectors/composio-run";
import { executeRecipeConnectorOperation } from "~/modules/apps/application/connectors/operations";
import type { IEnv } from "~/types";

import type { KnowledgeSyncRecord } from "../infrastructure/KnowledgeSyncRepository";
import { normaliseConfluencePage } from "./confluence-page";
import { requireKnowledgeSyncAuthority } from "./knowledge-sync-access";
import { parseKnowledgeSyncPages } from "./knowledge-sync-record";
import { enqueueKnowledgeSync } from "./knowledge-sync-tasks";

async function syncPages(context: ServiceContext, initial: KnowledgeSyncRecord, token: string) {
  const pages = parseKnowledgeSyncPages(initial);
  let sync = initial;

  for (let count = 0; count < 10; count++) {
    const page = pages[sync.cursor];

    if (!page) {
      throw new AssistantError(
        "Knowledge sync checkpoint is invalid",
        ErrorType.CONFIGURATION_ERROR,
        409,
      );
    }

    const connection = await requireKnowledgeSyncAuthority(context, sync);
    const sourceId = "confluence_" + (await sha256Hex(sync.id + ":" + page.pageId));
    let result: unknown;

    try {
      result = await executeRecipeConnectorOperation({
        context,
        userId: sync.user_id,
        request: {
          provider: "confluence",
          operation: CONFLUENCE_PAGE_READ_OPERATION,
          connectedAccountId: connection.external_id,
          params: page.readParameters,
        },
        scope: {
          completionId: context.connectorRunId,
          projectId: sync.project_id,
          recipeId: CONFLUENCE_KNOWLEDGE_RECIPE_ID,
        },
      });
    } catch (error) {
      if (error instanceof AssistantError && [403, 404].includes(error.statusCode)) {
        await requireKnowledgeSyncAuthority(context, sync);
        await context.repositories.knowledgeSyncs.markUnavailable(sync, token, sourceId);
      }

      throw error;
    }

    const document = normaliseConfluencePage(result, page.pageId);

    await requireKnowledgeSyncAuthority(context, sync);
    if (
      !(await context.repositories.knowledgeSyncs.commitPage(
        sync,
        token,
        sourceId,
        page.pageId,
        document,
        pages.length,
      ))
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
    await syncPages(context, sync, token);
  } catch (error) {
    pause = error instanceof AssistantError && [401, 403, 404].includes(error.statusCode);
    errorMessage = pause
      ? "Sync paused. Check project access and reconnect Confluence. The checkpoint was retained."
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
