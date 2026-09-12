import { teammateRunReconciliationTaskDataSchema } from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/lib/context/serviceContext";
import { reconcileRecipeExecutionTask } from "~/services/apps/recipes/task-reconciliation";
import { reconcileTeammateRun } from "~/services/teammates/run-reconciliation";
import type { IEnv } from "~/types";

import type { TaskHandler, TaskResult } from "../TaskHandler";
import type { TaskMessage } from "../TaskService";

export class TeammateRunReconciliationHandler implements TaskHandler {
  async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const payload = teammateRunReconciliationTaskDataSchema.parse(message.task_data);
    const baseContext = createServiceContext({ env });
    const run = await baseContext.repositories.conversationRuns.getById(payload.runId);

    if (!run || run.attempt !== payload.attempt) {
      return { status: "skipped", message: "Teammate run attempt has changed" };
    }

    const user = await baseContext.repositories.users.getUserById(run.initiatorUserId);

    if (!user || (message.user_id !== undefined && message.user_id !== user.id)) {
      return { status: "error", message: "Teammate run initiator is unavailable" };
    }

    const context = createServiceContext({ env, user });

    await reconcileRecipeExecutionTask(context, run);
    await reconcileTeammateRun(context, run);

    return { status: "success", message: "Teammate run reconciled" };
  }
}
