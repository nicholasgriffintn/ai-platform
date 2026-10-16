import { delegationExpiryTaskDataSchema } from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { cancelDelegationChildRun } from "~/modules/delegations/application/cancel-child-run";
import { scheduleDelegationWake } from "~/modules/delegations/application/schedule-wake";
import { transitionDelegation } from "~/modules/delegations/application/settle";
import { DelegationRepository } from "~/modules/delegations/infrastructure/DelegationRepository";
import { TaskService } from "~/modules/queue/application/TaskService";
import type { TaskHandler, TaskMessage, TaskResult } from "~/modules/queue/application/types";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import type { IEnv } from "~/types";

export class DelegationExpiryHandler implements TaskHandler {
  public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const payload = delegationExpiryTaskDataSchema.safeParse(message.task_data);
    const systemContext = createServiceContext({ env });

    if (!payload.success || message.user_id === undefined) {
      return { status: "error", message: "Invalid delegation expiry payload" };
    }

    const user = await systemContext.repositories.get(UserRepository).getUserById(message.user_id);

    if (!user) {
      return { status: "error", message: "Delegating user not found" };
    }

    const context = createServiceContext({ env, user });
    const delegation = await context.repositories
      .get(DelegationRepository)
      .getById(payload.data.delegationId);

    if (!delegation || Date.parse(delegation.budget.deadline) > Date.now()) {
      return { status: "skipped", message: "Delegation is no longer due to expire" };
    }

    await cancelDelegationChildRun(
      context,
      delegation,
      message.user_id,
      "The delegation deadline passed",
    );

    const updated = await transitionDelegation(
      context,
      delegation.id,
      "expired",
      {
        summary: "The delegate deadline passed while it was waiting for a response.",
        outputIds: [],
      },
      message.user_id,
    );

    if (updated) {
      await scheduleDelegationWake(
        new TaskService(context.env, context.repositories.get(TaskRepository)),
        delegation,
        message.user_id,
      );
    }

    return updated
      ? { status: "success", message: "Delegation expired" }
      : { status: "skipped", message: "Delegation had already settled" };
  }
}
