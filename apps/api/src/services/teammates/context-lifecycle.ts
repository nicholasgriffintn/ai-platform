import {
  TEAMMATE_CONTEXT_CLEANUP_TASK_TYPE,
  type TeammateContext,
  type TeammateContextStatus,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { TaskService } from "~/services/tasks/TaskService";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { revokeTeammateContextResources } from "./computers";
import { requireOwnedTeammateContext } from "./contexts";

export async function queueTeammateContextResourceCleanup(
  context: ServiceContext,
  teammateContexts: readonly TeammateContext[],
): Promise<void> {
  if (teammateContexts.length === 0) {
    return;
  }

  await new TaskService(context.env, context.repositories.tasks).enqueueTask({
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
    updated = await context.repositories.teammateContexts.updateStatus(contextId, status);
  } else {
    await mutateTeammateContextsWithCleanup(context, [teammateContext], async () => {
      updated = await context.repositories.teammateContexts.updateStatus(contextId, status);
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
  const contexts = await context.repositories.teammateContexts.listForProjectTeammate(
    projectId,
    teammateId,
  );

  await mutateTeammateContextsWithCleanup(context, contexts, () =>
    context.repositories.teammateContexts.archiveContexts(
      contexts.map((teammateContext) => teammateContext.id),
    ),
  );
}
