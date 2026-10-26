import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { createRepositories } from "~/infrastructure/database/repositories";
import { closeComposioConnectorRun } from "~/modules/connectors/application/composio-run";
import { syncConnectorResources } from "~/modules/knowledge/application/syncs/connector";
import { gatherFeed } from "~/modules/knowledge/application/syncs/feeds";
import {
  isConnectorKnowledgeSync,
  parseKnowledgeFeed,
} from "~/modules/knowledge/application/syncs/record";
import {
  enqueueKnowledgeSync,
  publishKnowledgeSyncChanged,
  requireKnowledgeSyncTarget,
} from "~/modules/knowledge/application/syncs/syncs";
import {
  KnowledgeSyncRepository,
  type KnowledgeSyncRecord,
} from "~/modules/knowledge/infrastructure/KnowledgeSyncRepository";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import type { IEnv } from "~/types";

async function syncFeed(context: ServiceContext, sync: KnowledgeSyncRecord, token: string) {
  const repository = context.repositories.get(KnowledgeSyncRepository);

  try {
    await gatherFeed(context, await requireKnowledgeSyncTarget(context, sync), {
      syncId: sync.id,
      feed: parseKnowledgeFeed(sync),
    });
    await requireKnowledgeSyncTarget(context, sync);
    await repository.completeFeedRun(sync, token);
  } catch (error) {
    await repository.deferFeedRun(sync, token);
    throw error;
  }
}

function describeFailure(sync: KnowledgeSyncRecord, pause: boolean): string {
  if (isConnectorKnowledgeSync(sync)) {
    return pause
      ? "Sync paused. Check project access and reconnect the source account. The checkpoint was retained."
      : "Sync failed. The checkpoint was retained for retry.";
  }

  return pause
    ? "Sync paused. Check the feed address and your access to where it files, then resume it."
    : "Sync failed. It will try again at the next interval.";
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
    await (isConnectorKnowledgeSync(sync)
      ? syncConnectorResources(context, sync, token)
      : syncFeed(context, sync, token));
  } catch (error) {
    pause = error instanceof AssistantError && [401, 403, 404].includes(error.statusCode);
    errorMessage = describeFailure(sync, pause);
    throw new AssistantError(errorMessage, ErrorType.PROVIDER_ERROR, 502);
  } finally {
    try {
      await knowledgeSyncs.release(id, token, errorMessage, pause);
      await publishKnowledgeSyncChanged(context, sync);
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
