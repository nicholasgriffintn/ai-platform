import { recipeExecutionTaskDataSchema, type ChatRun } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { isRunWaitingForDelegations } from "~/modules/delegations/application/wait-policy";
import { verifyRun } from "~/modules/documents/application/run-verification";
import { recordRecipeRoutineOutcome } from "~/modules/model-evaluation/application/routine-success";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";

const RECIPE_CONVERSATION_PREFIX = "recipe_";

export function getRecipeExecutionTaskId(conversationId: string): string | null {
  return conversationId.startsWith(RECIPE_CONVERSATION_PREFIX)
    ? conversationId.slice(RECIPE_CONVERSATION_PREFIX.length)
    : null;
}

export async function recordRecipeRunOutcome(
  context: ServiceContext,
  run: ChatRun,
  installationId: string,
): Promise<void> {
  const taskId = getRecipeExecutionTaskId(run.conversationId);

  if (!taskId || run.status === "cancelled") {
    return;
  }

  const status =
    run.status === "succeeded"
      ? (
          await verifyRun(context, {
            run,
            outputs: await context.repositories.get(OutputRepository).listOutputsForRun(run.id),
          })
        ).status
      : "failed";

  await recordRecipeRoutineOutcome(context, {
    taskId,
    userId: run.initiatorUserId,
    projectId: run.projectId,
    installationId,
    runId: run.id,
    status,
    occurredAt: run.completedAt ?? new Date().toISOString(),
  });
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

  const task = await context.repositories.get(TaskRepository).getTaskById(taskId);

  const taskData = recipeExecutionTaskDataSchema.safeParse(task?.task_data);

  if (!taskData.success) {
    return;
  }

  if (run.status === "succeeded" && (await isRunWaitingForDelegations(context, run.id))) {
    return;
  }

  const status =
    run.status === "succeeded" ? "completed" : run.status === "cancelled" ? "cancelled" : "failed";

  await context.repositories.get(TaskRepository).settleSuspendedRecipeTask({
    taskId,
    userId: run.initiatorUserId,
    status,
    completedAt: run.completedAt ?? new Date().toISOString(),
    ...(status === "failed"
      ? { errorMessage: run.terminalReason ?? "Recipe execution failed" }
      : {}),
  });

  if (taskData.data.installationId) {
    await recordRecipeRunOutcome(context, run, taskData.data.installationId);
  }
}
