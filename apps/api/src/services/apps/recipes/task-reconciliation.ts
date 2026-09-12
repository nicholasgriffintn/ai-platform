import { recipeExecutionTaskDataSchema, type ChatRun } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { isRunWaitingForDelegations } from "~/services/delegations/wait-policy";

const RECIPE_CONVERSATION_PREFIX = "recipe_";

export function getRecipeExecutionTaskId(conversationId: string): string | null {
  return conversationId.startsWith(RECIPE_CONVERSATION_PREFIX)
    ? conversationId.slice(RECIPE_CONVERSATION_PREFIX.length)
    : null;
}

export async function reconcileRecipeExecutionTask(
  context: ServiceContext,
  run: ChatRun,
): Promise<void> {
  if (
    !getRecipeExecutionTaskId(run.conversationId) ||
    !["succeeded", "failed", "cancelled", "interrupted"].includes(run.status)
  ) {
    return;
  }

  const taskId = getRecipeExecutionTaskId(run.conversationId);

  if (!taskId) {
    return;
  }

  const task = await context.repositories.tasks.getTaskById(taskId);

  if (!recipeExecutionTaskDataSchema.safeParse(task?.task_data).success) {
    return;
  }

  if (run.status === "succeeded" && (await isRunWaitingForDelegations(context, run.id))) {
    return;
  }

  const status =
    run.status === "succeeded" ? "completed" : run.status === "cancelled" ? "cancelled" : "failed";

  await context.repositories.tasks.settleSuspendedRecipeTask({
    taskId,
    userId: run.initiatorUserId,
    status,
    completedAt: run.completedAt ?? new Date().toISOString(),
    ...(status === "failed"
      ? { errorMessage: run.terminalReason ?? "Recipe execution failed" }
      : {}),
  });
}
