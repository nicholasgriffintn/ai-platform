import { memoryReflectionTaskDataSchema } from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { reflectTeammateMemory } from "~/modules/memory-documents/application/reflection";
import type { IEnv } from "~/types";

import type { TaskHandler, TaskMessage, TaskResult, TaskExecutionContext } from "../types";

export class MemoryReflectionHandler implements TaskHandler {
  async handle(
    message: TaskMessage,
    env: IEnv,
    execution: TaskExecutionContext,
  ): Promise<TaskResult> {
    const input = memoryReflectionTaskDataSchema.parse(message.task_data);

    if (!message.user_id) {
      return { status: "error", message: "Memory maintenance requires an owner" };
    }

    const user = await createServiceContext({ env }).repositories.users.getUserById(
      message.user_id,
    );

    if (!user) {
      return { status: "skipped", message: "Memory owner no longer exists" };
    }

    const outcome = await reflectTeammateMemory(
      createServiceContext({ env, user }),
      input,
      message.taskId,
      execution,
    );

    return {
      status: "success",
      message: outcome === "applied" ? "Teammate memory corrected" : "Memory is current",
      data: { outcome },
    };
  }
}
