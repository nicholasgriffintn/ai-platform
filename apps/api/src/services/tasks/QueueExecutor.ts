import {
	SANDBOX_RUN_DISPATCH_TASK_TYPE,
	type TaskType,
} from "@assistant/schemas";
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
import { SandboxRunDispatchHandler } from "./handlers/SandboxRunDispatchHandler";
import { PodcastTranscriptionPollingHandler } from "./handlers/PodcastTranscriptionPollingHandler";
import { TaskExecutor } from "./TaskExecutor";
import { TaskRepository } from "~/repositories/TaskRepository";

const logger = getLogger({ prefix: "services/tasks/queue-executor" });

export class QueueExecutor {
	public static async respondToCronQueue(
		env: IEnv,
		batch: MessageBatch<TaskMessage>,
	): Promise<void> {
		logger.info(`Processing batch of ${batch.messages.length} tasks`);

		const handlers = new Map<TaskType, TaskHandler>([
			["memory_synthesis", new MemorySynthesisHandler()],
			["research_polling", new ResearchPollingHandler()],
			["replicate_polling", new ReplicatePollingHandler()],
			["async_message_polling", new AsyncMessagePollingHandler()],
			[
				"podcast_transcription_polling",
				new PodcastTranscriptionPollingHandler(),
			],
			["training_quality_scoring", new TrainingQualityHandler()],
			["usage_update", new UsageUpdateHandler()],
			[SANDBOX_RUN_DISPATCH_TASK_TYPE, new SandboxRunDispatchHandler()],
		]);

		const taskExecutor = new TaskExecutor(env, handlers);
		const taskRepository = new TaskRepository(env);

		for (const message of batch.messages) {
			try {
				if (message.body.scheduled_at) {
					const scheduledAtMs = Date.parse(message.body.scheduled_at);
					if (Number.isFinite(scheduledAtMs) && scheduledAtMs > Date.now()) {
						logger.info(
							`Task ${message.body.taskId} is scheduled for later, retrying delivery`,
						);
						message.retry();
						continue;
					}
				}

				logger.info(
					`Processing task ${message.body.taskId} of type ${message.body.task_type}`,
				);

				await taskExecutor.execute(message.body);

				message.ack();

				logger.info(`Task ${message.body.taskId} acknowledged`);
			} catch (error) {
				logger.error(`Error processing task ${message.body.taskId}:`, error);
				const task = await taskRepository.getTaskById(message.body.taskId);
				if (!task || task.status === "failed" || task.status === "cancelled") {
					logger.error(
						`Task ${message.body.taskId} reached terminal state, acknowledging message`,
					);
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
