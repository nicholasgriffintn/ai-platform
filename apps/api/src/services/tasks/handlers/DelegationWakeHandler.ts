import { delegationWakeTaskDataSchema } from "@ngriffin_uk/polychat-schemas";

import type { IEnv } from "~/types";

import { wakeDelegationParent } from "../../delegations/wake";
import type { TaskHandler, TaskResult } from "../TaskHandler";
import type { TaskMessage } from "../TaskService";

export class DelegationWakeHandler implements TaskHandler {
  public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const payload = delegationWakeTaskDataSchema.safeParse(message.task_data);

    if (!payload.success || message.user_id === undefined) {
      return { status: "error", message: "Invalid delegation wake payload" };
    }

    const result = await wakeDelegationParent(message, env);

    return { status: result.status === "error" ? "error" : result.status, message: result.detail };
  }
}
