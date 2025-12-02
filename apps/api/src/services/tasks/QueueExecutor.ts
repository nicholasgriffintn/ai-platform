import { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";
import { TaskMessage } from "./TaskService";
import { TaskHandler } from "./TaskHandler";
import { MemorySynthesisHandler } from "./handlers/MemorySynthesisHandler";
import { ResearchPollingHandler } from "./handlers/ResearchPollingHandler";
import { ReplicatePollingHandler } from "./handlers/ReplicatePollingHandler";
import { AsyncMessagePollingHandler } from "./handlers/AsyncMessagePollingHandler";
import { TrainingQualityHandler } from "./handlers/TrainingQualityHandler";
import { UsageUpdateHandler } from "./handlers/UsageUpdateHandler";
import { TaskExecutor } from "./TaskExecutor";

const logger = getLogger({ prefix: "services/tasks/queue-executor" });

export class QueueExecutor {
	public static async respondToCronQueue(
		env: IEnv,
		batch: MessageBatch<TaskMessage>,
	): Promise<void> {
		logger.info(`Processing batch of ${batch.messages.length} tasks`);

		const handlers = new Map<string, TaskHandler>([
			["memory_synthesis", new MemorySynthesisHandler()],
			["research_polling", new ResearchPollingHandler()],
			["replicate_polling", new ReplicatePollingHandler()],
			["async_message_polling", new AsyncMessagePollingHandler()],
			["training_quality_scoring", new TrainingQualityHandler()],
			["usage_update", new UsageUpdateHandler()],
		]);

		const taskExecutor = new TaskExecutor(env, handlers);

		for (const message of batch.messages) {
			try {
				logger.info(
					`Processing task ${message.body.taskId} of type ${message.body.task_type}`,
				);

				await taskExecutor.execute(message.body);

				message.ack();

				logger.info(`Task ${message.body.taskId} acknowledged`);
			} catch (error) {
				logger.error(`Error processing task ${message.body.taskId}:`, error);

				if (message.attempts < 3) {
					logger.info(
						`Retrying task ${message.body.taskId}, attempt ${message.attempts + 1}/3`,
					);
					message.retry();
				} else {
					logger.error(
						`Task ${message.body.taskId} failed after 3 attempts, moving to DLQ`,
					);

					await taskExecutor.handleFailure(message.body, error as Error);
					message.ack();
				}
			}
		}

		logger.info(`Finished processing batch of tasks`);
	}
}
