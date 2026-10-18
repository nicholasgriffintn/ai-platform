import {
  TEAMMATE_CONTEXT_CLEANUP_TASK_TYPE,
  type TeammateAutonomyLevel,
  type TeammateContext,
  type TeammateContextStatus,
  type TeammateToolRule,
  TEAMMATE_PAUSE_MAX_HOURS,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";

import { revokeTeammateContextResources } from "./computers";
import { requireOwnedTeammateContext } from "./contexts";

export async function queueTeammateContextResourceCleanup(
  context: ServiceContext,
  teammateContexts: readonly TeammateContext[],
): Promise<void> {
  if (teammateContexts.length === 0) {
    return;
  }

  await new TaskService(context.env, context.repositories.get(TaskRepository)).enqueueTask({
    id: `teammate_context_cleanup_${generateId()}`,
    task_type: TEAMMATE_CONTEXT_CLEANUP_TASK_TYPE,
    ...(context.user?.id ? { user_id: context.user.id } : {}),
    task_data: { contextIds: teammateContexts.map((item) => item.id) },
    schedule_type: "scheduled",
    scheduled_at: new Date(Date.now() + 60_000).toISOString(),
    priority: 3,
  });
}

export async function mutateTeammateContextsWithCleanup(
  context: ServiceContext,
  teammateContexts: readonly TeammateContext[],
  mutation: () => Promise<void>,
  options: { cleanupBeforeMutation?: boolean } = {},
): Promise<void> {
  if (options.cleanupBeforeMutation) {
    await queueTeammateContextResourceCleanup(context, teammateContexts);
    await revokeTeammateContextResources(context, teammateContexts);
    await mutation();

    return;
  }

  let mutationError: unknown;

  try {
    await queueTeammateContextResourceCleanup(context, teammateContexts);
    await mutation();
  } catch (error) {
    mutationError = error;
  }

  try {
    await revokeTeammateContextResources(context, teammateContexts);
  } catch (revocationError) {
    if (mutationError) {
      const combinedError = new AggregateError(
        [mutationError, revocationError],
        "Teammate context mutation and resource revocation failed",
        { cause: mutationError },
      );

      throw combinedError;
    }

    throw revocationError;
  }

  if (mutationError) {
    throw mutationError;
  }
}

export async function updateTeammateContextAutonomy(
  context: ServiceContext,
  contextId: string,
  autonomyLevel: TeammateAutonomyLevel,
): Promise<TeammateContext> {
  await requireOwnedTeammateContext(context, contextId);
  const updated = await context.repositories
    .get(TeammateContextRepository)
    .updateAutonomyLevel(contextId, autonomyLevel);

  if (!updated) {
    throw new AssistantError("Teammate context not found", ErrorType.NOT_FOUND, 404);
  }

  return updated;
}

export async function updateTeammateContextToolRules(
  context: ServiceContext,
  contextId: string,
  toolRules: readonly TeammateToolRule[],
): Promise<TeammateContext> {
  await requireOwnedTeammateContext(context, contextId);
  const updated = await context.repositories
    .get(TeammateContextRepository)
    .updateToolRules(contextId, toolRules);

  if (!updated) {
    throw new AssistantError("Teammate context not found", ErrorType.NOT_FOUND, 404);
  }

  return updated;
}

export async function updateTeammateContextPause(
  context: ServiceContext,
  contextId: string,
  pausedUntil: string | null,
  now = Date.now(),
): Promise<TeammateContext> {
  await requireOwnedTeammateContext(context, contextId);

  if (pausedUntil !== null) {
    const endsAt = Date.parse(pausedUntil);

    if (endsAt <= now || endsAt - now > TEAMMATE_PAUSE_MAX_HOURS * 60 * 60 * 1000) {
      throw new AssistantError(
        `A pause must end in the future and within ${TEAMMATE_PAUSE_MAX_HOURS / 24} days`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  }

  const updated = await context.repositories
    .get(TeammateContextRepository)
    .updatePausedUntil(contextId, pausedUntil);

  if (!updated) {
    throw new AssistantError("Teammate context not found", ErrorType.NOT_FOUND, 404);
  }

  return updated;
}

export async function updateTeammateContextStatus(
  context: ServiceContext,
  contextId: string,
  status: TeammateContextStatus,
): Promise<TeammateContext> {
  const teammateContext = await requireOwnedTeammateContext(context, contextId);

  if (teammateContext.status === status) {
    if (status !== "active") {
      await mutateTeammateContextsWithCleanup(context, [teammateContext], async () => undefined);
    }

    return teammateContext;
  }

  if (status === "active") {
    await revokeTeammateContextResources(context, [teammateContext]);
  }

  let updated: TeammateContext | null = null;

  if (status === "active") {
    updated = await context.repositories
      .get(TeammateContextRepository)
      .updateStatus(contextId, status);
  } else {
    await mutateTeammateContextsWithCleanup(context, [teammateContext], async () => {
      updated = await context.repositories
        .get(TeammateContextRepository)
        .updateStatus(contextId, status);
    });
  }

  if (!updated) {
    throw new AssistantError("Teammate context not found", ErrorType.NOT_FOUND, 404);
  }

  return updated;
}

export async function archiveProjectTeammateContexts(
  context: ServiceContext,
  projectId: string,
  teammateId: string,
): Promise<void> {
  const contexts = await context.repositories
    .get(TeammateContextRepository)
    .listForProjectTeammate(projectId, teammateId);

  await mutateTeammateContextsWithCleanup(context, contexts, () =>
    context.repositories
      .get(TeammateContextRepository)
      .archiveContexts(contexts.map((teammateContext) => teammateContext.id)),
  );
}
