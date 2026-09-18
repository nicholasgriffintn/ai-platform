import { delegationRunTaskDataSchema } from "@ngriffin_uk/polychat-schemas";

import { runDelegationTask } from "~/modules/delegations/application/run";
import type { IEnv } from "~/types";

import type { TaskHandler, TaskMessage, TaskResult } from "../types";

export class DelegationRunHandler implements TaskHandler {
  public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const payload = delegationRunTaskDataSchema.safeParse(message.task_data);

    if (!payload.success || message.user_id === undefined) {
      return { status: "error", message: "Invalid delegation run payload" };
    }

    const result = await runDelegationTask(message, env);

    return {
      status: result.status === "error" ? "error" : result.status,
      message: result.detail,
    };
  }
}
