import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { isTaskError, leaseRetryDelaySeconds } from "@ngriffin_uk/polychat-library-tasks";

import { MAX_QUEUE_DELAY_SECONDS } from "~/config/limits";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import type { IEnv } from "~/types";

import { TaskExecutor } from "./TaskExecutor";
import type { TaskMessage } from "./types";
import type { AppWorkflows } from "./workflows";

const logger = getLogger({ prefix: "services/tasks/queue-executor" });

export class QueueExecutor {
  public static async respondToCronQueue(
    env: IEnv,
    messages: readonly Message<TaskMessage>[],
    workflows: AppWorkflows,
  ): Promise<void> {
    logger.info(`Processing batch of ${messages.length} tasks`);

    const taskExecutor = new TaskExecutor(env, workflows.handlers());
    const taskRepository = new TaskRepository(env);

    for (const message of messages) {
      const taskMessage = message.body;

      try {
        if (taskMessage.scheduled_at) {
          const scheduledAtMs = Date.parse(taskMessage.scheduled_at);

          if (Number.isFinite(scheduledAtMs) && scheduledAtMs > Date.now()) {
            const remainingSeconds = Math.ceil((scheduledAtMs - Date.now()) / 1000);

            logger.info(`Task ${taskMessage.taskId} is scheduled for later, retrying delivery`);
            message.retry({ delaySeconds: Math.min(remainingSeconds, MAX_QUEUE_DELAY_SECONDS) });
            continue;
          }
        }

        logger.info(`Processing task ${taskMessage.taskId} of type ${taskMessage.task_type}`);

        await taskExecutor.execute(taskMessage, message.attempts);

        message.ack();

        logger.info(`Task ${taskMessage.taskId} acknowledged`);
      } catch (error) {
        logger.error(`Error processing task ${taskMessage.taskId}:`, error);

        if (isTaskError(error, "lease_busy")) {
          message.retry({
            delaySeconds: Math.min(
              leaseRetryDelaySeconds(
                typeof error.details?.expiresAt === "string" ? error.details.expiresAt : "",
              ),
              MAX_QUEUE_DELAY_SECONDS,
            ),
          });
          continue;
        }

        const task = await taskRepository.getTaskById(taskMessage.taskId);

        if (task?.status === "completed") {
          message.ack();
          continue;
        }

        if (!task || task.status === "failed" || task.status === "cancelled") {
          logger.error(`Task ${taskMessage.taskId} reached terminal state, acknowledging message`);
          await taskExecutor.handleFailure(taskMessage, error as Error);
          message.ack();
          continue;
        }

        logger.info(`Retrying task ${taskMessage.taskId}`);
        message.retry();
      }
    }

    logger.info(`Finished processing batch of tasks`);
  }
}
