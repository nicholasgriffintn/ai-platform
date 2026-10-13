import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { isTaskError, leaseRetryDelaySeconds } from "@ngriffin_uk/polychat-library-tasks";

import { MAX_QUEUE_DELAY_SECONDS } from "~/config/limits";
import { TaskRepository } from "~/modules/tasks/infrastructure/TaskRepository";
import {
  isInfraUsageQueueMessage,
  rollUpInfraUsageMessages,
  type InfraUsageQueueMessage,
} from "~/modules/usage/application/infra-usage-queue";
import type { IEnv } from "~/types";

import { workflows } from "./registry";
import { TaskExecutor } from "./TaskExecutor";
import type { TaskMessage } from "./types";

const logger = getLogger({ prefix: "services/tasks/queue-executor" });

export class QueueExecutor {
  public static async respondToCronQueue(
    env: IEnv,
    batch: MessageBatch<TaskMessage | InfraUsageQueueMessage>,
  ): Promise<void> {
    logger.info(`Processing batch of ${batch.messages.length} tasks`);

    const taskExecutor = new TaskExecutor(env, workflows.handlers());
    const taskRepository = new TaskRepository(env);
    const infraUsageMessages: Message[] = [];

    for (const message of batch.messages) {
      const taskMessage = message.body;

      if (isInfraUsageQueueMessage(taskMessage)) {
        infraUsageMessages.push(message);
        continue;
      }

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

    if (infraUsageMessages.length > 0) {
      try {
        await rollUpInfraUsageMessages(env, infraUsageMessages);
      } catch (error) {
        logger.error("Failed to roll up infrastructure usage", { error });

        for (const message of infraUsageMessages) {
          message.retry();
        }
      }
    }

    logger.info(`Finished processing batch of tasks`);
  }
}
