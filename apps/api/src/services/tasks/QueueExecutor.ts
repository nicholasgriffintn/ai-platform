import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { isTaskError, leaseRetryDelaySeconds } from "@ngriffin_uk/polychat-library-tasks";

import { TaskRepository } from "~/repositories/TaskRepository";
import type { IEnv } from "~/types";

import { workflows } from "./registry";
import { TaskExecutor } from "./TaskExecutor";
import { MAX_QUEUE_DELAY_SECONDS } from "./TaskService";
import type { TaskMessage } from "./types";

const logger = getLogger({ prefix: "services/tasks/queue-executor" });

export class QueueExecutor {
  public static async respondToCronQueue(
    env: IEnv,
    batch: MessageBatch<TaskMessage>,
  ): Promise<void> {
    logger.info(`Processing batch of ${batch.messages.length} tasks`);

    const taskExecutor = new TaskExecutor(env, workflows.handlers());
    const taskRepository = new TaskRepository(env);

    for (const message of batch.messages) {
      try {
        if (message.body.scheduled_at) {
          const scheduledAtMs = Date.parse(message.body.scheduled_at);

          if (Number.isFinite(scheduledAtMs) && scheduledAtMs > Date.now()) {
            const remainingSeconds = Math.ceil((scheduledAtMs - Date.now()) / 1000);

            logger.info(`Task ${message.body.taskId} is scheduled for later, retrying delivery`);
            message.retry({ delaySeconds: Math.min(remainingSeconds, MAX_QUEUE_DELAY_SECONDS) });
            continue;
          }
        }

        logger.info(`Processing task ${message.body.taskId} of type ${message.body.task_type}`);

        await taskExecutor.execute(message.body, message.attempts);

        message.ack();

        logger.info(`Task ${message.body.taskId} acknowledged`);
      } catch (error) {
        logger.error(`Error processing task ${message.body.taskId}:`, error);

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

        const task = await taskRepository.getTaskById(message.body.taskId);

        if (task?.status === "completed") {
          message.ack();
          continue;
        }

        if (!task || task.status === "failed" || task.status === "cancelled") {
          logger.error(`Task ${message.body.taskId} reached terminal state, acknowledging message`);
          await taskExecutor.handleFailure(message.body, error as Error);
          message.ack();
          continue;
        }

        logger.info(`Retrying task ${message.body.taskId}`);
        message.retry();
      }
    }

    logger.info(`Finished processing batch of tasks`);
  }
}
