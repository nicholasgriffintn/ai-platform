import { projectTaskRunDispatchPayloadSchema } from "@ngriffin_uk/polychat-schemas";

import { recordChatRunOperationalMetric } from "~/services/chat-runs/operational-metrics";
import {
  runProjectTaskDispatch,
  settleFailedProjectTaskDispatch,
} from "~/services/project-tasks/runner";
import {
  isTaskExecutionOwnershipLostError,
  TaskExecutionLeaseBusyError,
} from "~/services/tasks/task-execution-lease";
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
        executionLease: execution.lease,
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
      if (
        isTaskExecutionOwnershipLostError(error) ||
        error instanceof TaskExecutionLeaseBusyError
      ) {
        if (isTaskExecutionOwnershipLostError(error)) {
          recordChatRunOperationalMetric(env, {
            signal: "ownership_loss",
            taskId: payload.data.taskId,
            outcome: "interrupted",
          });
        }

        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : "Project task run failed";

      await settleFailedProjectTaskDispatch({
        env,
        dispatchTaskId: payload.data.dispatchTaskId,
        taskId: payload.data.taskId,
        executionLease: execution.lease,
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

  public async onFinalFailure(
    message: TaskMessage,
    env: IEnv,
    error: Error,
    execution: TaskExecutionContext,
  ): Promise<void> {
    const payload = projectTaskRunDispatchPayloadSchema.safeParse(message.task_data);

    if (!payload.success) {
      return;
    }

    await settleFailedProjectTaskDispatch({
      env,
      dispatchTaskId: payload.data.dispatchTaskId,
      taskId: payload.data.taskId,
      executionLease: execution.lease,
      detail: error.message,
    });
  }
}
