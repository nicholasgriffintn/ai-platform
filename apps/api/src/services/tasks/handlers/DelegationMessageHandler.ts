import { delegationMessageTaskDataSchema } from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/lib/context/serviceContext";
import type { IEnv } from "~/types";

import { deliverDelegationMessage } from "../../delegations/message";
import type { TaskHandler, TaskResult } from "../TaskHandler";
import type { TaskMessage } from "../TaskService";

export class DelegationMessageHandler implements TaskHandler {
  public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const payload = delegationMessageTaskDataSchema.safeParse(message.task_data);

    if (!payload.success || message.user_id === undefined) {
      return { status: "error", message: "Invalid delegation message payload" };
    }

    const user = await createServiceContext({ env }).repositories.users.getUserById(
      message.user_id,
    );

    if (!user) {
      return { status: "error", message: "Delegating user not found" };
    }

    const delivered = await deliverDelegationMessage(
      createServiceContext({ env, user }),
      payload.data.delegationId,
      payload.data.message,
      undefined,
    );

    return delivered
      ? { status: "success", message: "Delegation message delivered" }
      : { status: "error", message: "Parent conversation is busy" };
  }
}
