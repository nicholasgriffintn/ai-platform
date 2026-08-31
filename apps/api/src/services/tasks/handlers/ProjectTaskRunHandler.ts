import { projectTaskRunDispatchPayloadSchema } from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/lib/context/serviceContext";
import { runProjectTaskDispatch } from "~/services/project-tasks/runner";
import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";

import type { TaskExecutionContext, TaskHandler, TaskResult } from "../TaskHandler";
import type { TaskMessage } from "../TaskService";

const logger = getLogger({
  prefix: "services/tasks/handlers/project-task-run",
});

export class ProjectTaskRunHandler implements TaskHandler {
  public async handle(
    message: TaskMessage,
    env: IEnv,
    execution: TaskExecutionContext,
  ): Promise<TaskResult> {
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
        dispatchTaskId: payload.data.dispatchTaskId,
        taskId: payload.data.taskId,
        projectId: payload.data.projectId,
        runnerIdentityUserId: payload.data.runnerIdentityUserId,
        conversationId: payload.data.conversationId,
        approvedTools: payload.data.approvedTools,
        resumeInterrupted: execution.isRedelivery,
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

      await createServiceContext({ env }).repositories.projectTasks.failDispatch({
        taskId: payload.data.taskId,
        projectId: payload.data.projectId,
        dispatchTaskId: payload.data.dispatchTaskId,
        detail: "The agent run failed before it could start. Try again.",
      });

      logger.error("Project task run task failed", {
        task_id: message.taskId,
        error_message: errorMessage,
      });

      return {
        status: "success",
        message: "Task run stopped before execution and was returned for attention",
        data: { taskId: payload.data.taskId, outcome: "blocked" },
      };
    }
  }
}
