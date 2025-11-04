import type { IEnv } from "~/types";
import type { TaskMessage } from "./TaskService";
import type { TaskHandler, TaskResult } from "./TaskHandler";
import { TaskRepository } from "~/repositories/TaskRepository";
import { getLogger } from "~/utils/logger";
import { generateId } from "~/utils/id";

const logger = getLogger({ prefix: "services/tasks/executor" });

export class TaskExecutor {
	private env: IEnv;
	private handlers: Map<string, TaskHandler>;
	private taskRepository: TaskRepository;

	constructor(env: IEnv, handlers: Map<string, TaskHandler>) {
		this.env = env;
		this.handlers = handlers;
		this.taskRepository = new TaskRepository(env);
	}

	public async execute(message: TaskMessage): Promise<void> {
		const startTime = Date.now();

		try {
			const isEnabledEnvVar = `${message.task_type
				.toUpperCase()
				.replace(/ /g, "_")}_ENABLED`;
			if (this.env[isEnabledEnvVar] !== "true") {
				logger.info(
					`Task type ${message.task_type} is disabled via environment variable`,
				);
				return;
			}

			const handler = this.handlers.get(message.task_type);
			if (!handler) {
				throw new Error(`Unknown task type: ${message.task_type}`);
			}

			await this.taskRepository.updateTask(message.taskId, {
				status: "running",
				last_attempted_at: new Date().toISOString(),
			});

			const executionId = await this.recordExecutionStart(message.taskId);

			try {
				const result = await handler.handle(message, this.env);

				if (result.status === "error") {
					throw new Error(
						result.message || "Unknown error during task execution",
					);
				}

				const executionTime = Date.now() - startTime;

				await this.recordExecutionSuccess(executionId, executionTime, result);

				await this.taskRepository.updateTask(message.taskId, {
					status: "completed",
					completed_at: new Date().toISOString(),
				});

				logger.info(
					`Task ${message.taskId} completed successfully in ${executionTime}ms`,
				);
			} catch (error) {
				const executionTime = Date.now() - startTime;

				await this.recordExecutionFailure(
					executionId,
					executionTime,
					error as Error,
				);

				const task = await this.taskRepository.getTaskById(message.taskId);
				if (task) {
					const newAttempts = (task.attempts || 0) + 1;

					if (newAttempts >= (task.max_attempts || 3)) {
						await this.taskRepository.updateTask(message.taskId, {
							status: "failed",
							attempts: newAttempts,
							error_message: (error as Error).message,
						});
						logger.error(
							`Task ${message.taskId} failed after ${newAttempts} attempts`,
						);
					} else {
						await this.taskRepository.updateTask(message.taskId, {
							status: "queued",
							attempts: newAttempts,
							error_message: (error as Error).message,
						});
						logger.warn(
							`Task ${message.taskId} failed, attempt ${newAttempts}/${task.max_attempts}`,
						);
					}
				}

				throw error;
			}
		} catch (error) {
			logger.error(`Task execution error for ${message.taskId}:`, error);
			throw error;
		}
	}

	private async recordExecutionStart(taskId: string): Promise<string> {
		const execution = await this.taskRepository.createTaskExecution(
			taskId,
			"running",
		);
		return execution?.id || generateId();
	}

	private async recordExecutionSuccess(
		executionId: string,
		executionTimeMs: number,
		result: TaskResult,
	): Promise<void> {
		await this.taskRepository.updateTaskExecution(
			executionId,
			"completed",
			executionTimeMs,
			undefined,
			result.data,
		);
	}

	private async recordExecutionFailure(
		executionId: string,
		executionTimeMs: number,
		error: Error,
	): Promise<void> {
		await this.taskRepository.updateTaskExecution(
			executionId,
			"failed",
			executionTimeMs,
			error.message,
			{ stack: error.stack },
		);
	}

	public async handleFailure(
		message: TaskMessage,
		error: Error,
	): Promise<void> {
		logger.error(`Task ${message.taskId} moved to DLQ:`, error);

		await this.taskRepository.updateTask(message.taskId, {
			status: "failed",
			error_message: error.message,
		});
	}
}
