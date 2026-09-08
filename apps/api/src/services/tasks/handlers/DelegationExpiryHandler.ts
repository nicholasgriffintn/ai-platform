import {
  DELEGATION_WAKE_TASK_TYPE,
  delegationExpiryTaskDataSchema,
} from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/lib/context/serviceContext";
import { TaskService } from "~/services/tasks/TaskService";
import type { IEnv } from "~/types";

import type { TaskHandler, TaskResult } from "../TaskHandler";
import type { TaskMessage } from "../TaskService";

export class DelegationExpiryHandler implements TaskHandler {
  public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const payload = delegationExpiryTaskDataSchema.safeParse(message.task_data);
    const context = createServiceContext({ env });

    if (!payload.success || message.user_id === undefined) {
      return { status: "error", message: "Invalid delegation expiry payload" };
    }

    const delegation = await context.repositories.delegations.getById(payload.data.delegationId);

    if (!delegation || Date.parse(delegation.budget.deadline) > Date.now()) {
      return { status: "skipped", message: "Delegation is no longer due to expire" };
    }

    const updated = await context.repositories.delegations.expireIfLive(
      delegation.id,
      "The delegate deadline passed while it was waiting for a response.",
    );

    if (updated) {
      await new TaskService(context.env, context.repositories.tasks).enqueueTask({
        id: `delegation_wake_${delegation.parentRunId}`,
        task_type: DELEGATION_WAKE_TASK_TYPE,
        user_id: message.user_id,
        priority: 4,
        task_data: {
          parentConversationId: delegation.parentConversationId,
          parentRunId: delegation.parentRunId,
        },
      });
    }

    return updated
      ? { status: "success", message: "Delegation expired" }
      : { status: "skipped", message: "Delegation had already settled" };
  }
}
