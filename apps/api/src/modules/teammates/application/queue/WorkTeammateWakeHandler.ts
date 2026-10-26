import { workTeammateWakeTaskDataSchema } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import type { TaskHandler, TaskMessage, TaskResult } from "~/modules/queue/application/types";
import { runTeammateWake } from "~/modules/teammates/application/wakes";
import type { IEnv } from "~/types";

export class WorkTeammateWakeHandler implements TaskHandler {
  async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const payload = workTeammateWakeTaskDataSchema.safeParse(message.task_data);

    if (!payload.success || !message.user_id) {
      return { status: "error", message: "Teammate wake task data is invalid" };
    }

    try {
      await runTeammateWake(env, message.user_id, payload.data);

      return { status: "success", message: "Teammate woke" };
    } catch (error) {
      return { status: "error", message: getErrorMessage(error) };
    }
  }
}
