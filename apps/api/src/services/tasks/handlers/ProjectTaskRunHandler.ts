import { projectTaskRunDispatchPayloadSchema } from "@ngriffin_uk/polychat-schemas";

import { runProjectTaskDispatch } from "~/services/project-tasks/runner";
import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";

import type { TaskHandler, TaskResult } from "../TaskHandler";
import type { TaskMessage } from "../TaskService";

const logger = getLogger({
  prefix: "services/tasks/handlers/project-task-run",
});

export class ProjectTaskRunHandler implements TaskHandler {
  public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const payload = projectTaskRunDispatchPayloadSchema.safeParse(message.task_data);

    if (!payload.success) {
      return { status: "error", message: "Invalid project task run payload" };
    }

    if (message.user_id !== payload.data.runnerIdentityUserId) {
      return {
        status: "error",
        message: "Project task run identity does not match the queued task owner",
      };
    }

    try {
      const result = await runProjectTaskDispatch({
        env,
        taskId: payload.data.taskId,
        projectId: payload.data.projectId,
        runnerIdentityUserId: payload.data.runnerIdentityUserId,
      });

      if (result.status === "skipped") {
        return {
          status: "skipped",
          message: result.detail ?? "Task run skipped",
        };
      }

      return {
        status: "success",
        message:
          result.status === "blocked"
            ? `Task run stopped and needs a person: ${result.detail ?? "blocked"}`
            : "Task run completed",
        data: { taskId: payload.data.taskId, outcome: result.status },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Project task run failed";

      logger.error("Project task run task failed", {
        task_id: message.taskId,
        error_message: errorMessage,
      });

      return { status: "error", message: errorMessage };
    }
  }
}
