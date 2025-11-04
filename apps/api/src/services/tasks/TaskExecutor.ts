import type { IEnv } from "~/types";
import type { TaskMessage } from "./TaskService";
import type { TaskHandler, TaskResult } from "./TaskHandler";
import { TaskRepository } from "~/repositories/TaskRepository";
import { logger } from "~/lib/log";
import { generateId } from "~/utils/id";

/**
 * TaskExecutor manages task execution lifecycle
 */
export class TaskExecutor {
	private env: IEnv;
	private handlers: Map<string, TaskHandler>;
	private taskRepository: TaskRepository;

	constructor(env: IEnv, handlers: Map<string, TaskHandler>) {
		this.env = env;
		this.handlers = handlers;
		this.taskRepository = new TaskRepository(env);
	}

	/**
	 * Execute a task
	 */
	public async execute(message: TaskMessage): Promise<void> {
		const startTime = Date.now();

		try {
			// Get the handler for this task type
			const handler = this.handlers.get(message.task_type);
			if (!handler) {
				throw new Error(`Unknown task type: ${message.task_type}`);
			}

			// Update task status to running
			await this.taskRepository.updateTask(message.taskId, {
				status: "running",
				last_attempted_at: new Date().toISOString(),
			});

			// Create execution record
			const executionId = await this.recordExecutionStart(message.taskId);

			try {
				// Execute the task
				const result = await handler.handle(message, this.env);

				// Calculate execution time
				const executionTime = Date.now() - startTime;

				// Record successful execution
				await this.recordExecutionSuccess(
					executionId,
					executionTime,
					result,
				);

				// Update task as completed
				await this.taskRepository.updateTask(message.taskId, {
					status: "completed",
					completed_at: new Date().toISOString(),
				});

				logger.info(
					`Task ${message.taskId} completed successfully in ${executionTime}ms`,
				);
			} catch (error) {
				// Calculate execution time
				const executionTime = Date.now() - startTime;

				// Record failed execution
				await this.recordExecutionFailure(
					executionId,
					executionTime,
					error as Error,
				);

				// Increment attempt counter
				const task = await this.taskRepository.getTaskById(message.taskId);
				if (task) {
					const newAttempts = (task.attempts || 0) + 1;

					if (newAttempts >= (task.max_attempts || 3)) {
						// Max attempts reached, mark as failed
						await this.taskRepository.updateTask(message.taskId, {
							status: "failed",
							attempts: newAttempts,
							error_message: (error as Error).message,
						});
						logger.error(
							`Task ${message.taskId} failed after ${newAttempts} attempts`,
						);
					} else {
						// Update attempt count, will be retried
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

	/**
	 * Record the start of a task execution
	 */
	private async recordExecutionStart(taskId: string): Promise<string> {
		const execution = await this.taskRepository.createTaskExecution(
			taskId,
			"running",
		);
		return execution?.id || generateId();
	}

	/**
	 * Record a successful task execution
	 */
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

	/**
	 * Record a failed task execution
	 */
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

	/**
	 * Handle a task failure
	 */
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
