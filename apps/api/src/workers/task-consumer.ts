import type { IEnv } from "~/types";
import type { TaskMessage } from "~/services/tasks/TaskService";
import type { TaskHandler } from "~/services/tasks/TaskHandler";
import { TaskExecutor } from "~/services/tasks/TaskExecutor";
import { MemorySynthesisHandler } from "~/services/tasks/handlers/MemorySynthesisHandler";
import { logger } from "~/lib/log";

/**
 * Task Consumer Worker
 * Processes tasks from the TASK_QUEUE
 */
export default {
	async queue(
		batch: MessageBatch<TaskMessage>,
		env: IEnv,
		ctx: ExecutionContext,
	): Promise<void> {
		logger.info(`Processing batch of ${batch.messages.length} tasks`);

		// Create task handler registry
		const handlers = new Map<string, TaskHandler>([
			["memory_synthesis", new MemorySynthesisHandler()],
			// Add more handlers here as needed
			// ["user_automation", new UserAutomationHandler()],
			// ["cleanup", new CleanupHandler()],
			// ["analytics", new AnalyticsHandler()],
		]);

		const taskExecutor = new TaskExecutor(env, handlers);

		for (const message of batch.messages) {
			try {
				logger.info(
					`Processing task ${message.body.taskId} of type ${message.body.task_type}`,
				);

				// Execute the task
				await taskExecutor.execute(message.body);

				// Acknowledge successful processing
				message.ack();

				logger.info(`Task ${message.body.taskId} acknowledged`);
			} catch (error) {
				logger.error(
					`Error processing task ${message.body.taskId}:`,
					error,
				);

				// Retry logic
				if (message.attempts < 3) {
					logger.info(
						`Retrying task ${message.body.taskId}, attempt ${message.attempts + 1}/3`,
					);
					message.retry();
				} else {
					logger.error(
						`Task ${message.body.taskId} failed after 3 attempts, moving to DLQ`,
					);
					// Handle failure and move to DLQ
					await taskExecutor.handleFailure(
						message.body,
						error as Error,
					);
					message.ack();
				}
			}
		}

		logger.info(`Batch processing completed`);
	},
};
