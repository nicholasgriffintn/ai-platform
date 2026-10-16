import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import { teammateRunReconciliationTaskDataSchema } from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import type { TaskHandler, TaskMessage, TaskResult } from "~/modules/queue/application/types";
import { reconcileRecipeExecutionTask } from "~/modules/recipes/application/task-reconciliation";
import { reconcileTeammateRun } from "~/modules/teammates/application/run-reconciliation";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import type { IEnv } from "~/types";

export class TeammateRunReconciliationHandler implements TaskHandler {
  async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const payload = teammateRunReconciliationTaskDataSchema.parse(message.task_data);
    const baseContext = createServiceContext({ env });
    const run = await baseContext.repositories
      .get(ConversationRunRepository)
      .getById(payload.runId);

    if (!run || run.attempt !== payload.attempt) {
      return { status: "skipped", message: "Teammate run attempt has changed" };
    }

    const user = await baseContext.repositories
      .get(UserRepository)
      .getUserById(run.initiatorUserId);

    if (!user || (message.user_id !== undefined && !ownsResource(user.id, message.user_id))) {
      return { status: "error", message: "Teammate run initiator is unavailable" };
    }

    const context = createServiceContext({ env, user });

    await reconcileRecipeExecutionTask(context, run);
    await reconcileTeammateRun(context, run);

    return { status: "success", message: "Teammate run reconciled" };
  }
}
