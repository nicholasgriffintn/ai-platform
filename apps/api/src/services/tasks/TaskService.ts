import type { IEnv } from "~/types";
import type { TaskRepository } from "~/repositories/TaskRepository";
import type { Task } from "~/lib/database/schema";
import { logger } from "~/lib/log";

export interface TaskDefinition {
	task_type: "memory_synthesis" | "user_automation" | "cleanup" | "analytics";
	user_id?: number;
	task_data: Record<string, any>;
	schedule_type?: "immediate" | "scheduled" | "recurring" | "event_triggered";
	scheduled_at?: string;
	cron_expression?: string;
	priority?: number;
	metadata?: Record<string, any>;
}

export interface TaskMessage {
	taskId: string;
	task_type: string;
	user_id?: number;
	task_data: Record<string, any>;
	priority: number;
}

export class TaskService {
	private env: IEnv;
	private taskRepository: TaskRepository;

	constructor(env: IEnv, taskRepository: TaskRepository) {
		this.env = env;
		this.taskRepository = taskRepository;
	}

	/**
	 * Enqueue a task to be processed by the task consumer
	 */
	public async enqueueTask(taskDef: TaskDefinition): Promise<string> {
		try {
			// 1. Create task record in D1
			const task = await this.taskRepository.createTask({
				task_type: taskDef.task_type,
				user_id: taskDef.user_id,
				task_data: taskDef.task_data,
				schedule_type: taskDef.schedule_type ?? "immediate",
				scheduled_at: taskDef.scheduled_at,
				cron_expression: taskDef.cron_expression,
				priority: taskDef.priority ?? 5,
				metadata: taskDef.metadata,
				created_by: taskDef.user_id ? "user" : "system",
			});

			if (!task) {
				throw new Error("Failed to create task record");
			}

			// 2. Update task status to queued
			await this.taskRepository.updateTask(task.id, { status: "queued" });

			// 3. Send to Cloudflare Queue
			const message: TaskMessage = {
				taskId: task.id,
				task_type: taskDef.task_type,
				user_id: taskDef.user_id,
				task_data: taskDef.task_data,
				priority: taskDef.priority ?? 5,
			};

			// Check if TASK_QUEUE is available
			if (!this.env.TASK_QUEUE) {
				logger.warn(
					"TASK_QUEUE binding not available, task will remain in queued status",
				);
				logger.info(`Task ${task.id} created but not sent to queue`);
				return task.id;
			}

			await this.env.TASK_QUEUE.send(message);

			logger.info(`Task ${task.id} enqueued successfully`);
			return task.id;
		} catch (error) {
			logger.error("Failed to enqueue task:", error);
			throw error;
		}
	}

	/**
	 * Schedule a recurring task using cron expression
	 */
	public async scheduleRecurringTask(
		taskDef: TaskDefinition,
		cronExpression: string,
	): Promise<string> {
		const task = await this.taskRepository.createTask({
			task_type: taskDef.task_type,
			user_id: taskDef.user_id,
			task_data: taskDef.task_data,
			schedule_type: "recurring",
			cron_expression: cronExpression,
			priority: taskDef.priority ?? 5,
			metadata: taskDef.metadata,
			created_by: taskDef.user_id ? "user" : "system",
		});

		if (!task) {
			throw new Error("Failed to create recurring task");
		}

		logger.info(`Recurring task ${task.id} scheduled with cron: ${cronExpression}`);
		return task.id;
	}

	/**
	 * Get task by ID
	 */
	public async getTask(taskId: string): Promise<Task | null> {
		return this.taskRepository.getTaskById(taskId);
	}

	/**
	 * Get tasks for a user
	 */
	public async getUserTasks(userId: number, limit = 50): Promise<Task[]> {
		return this.taskRepository.getTasksByUserId(userId, limit);
	}

	/**
	 * Cancel a task
	 */
	public async cancelTask(taskId: string): Promise<boolean> {
		const task = await this.taskRepository.getTaskById(taskId);
		if (!task) {
			return false;
		}

		if (task.status === "completed" || task.status === "cancelled") {
			return false;
		}

		await this.taskRepository.updateTask(taskId, { status: "cancelled" });
		return true;
	}
}
