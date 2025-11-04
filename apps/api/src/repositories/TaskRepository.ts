import { BaseRepository } from "./BaseRepository";
import type { Task, TaskExecution } from "~/lib/database/schema";
import { generateId } from "~/utils/id";

export interface CreateTaskParams {
	task_type: "memory_synthesis" | "user_automation" | "cleanup" | "analytics";
	user_id?: number;
	task_data?: Record<string, any>;
	schedule_type?: "immediate" | "scheduled" | "recurring" | "event_triggered";
	scheduled_at?: string;
	cron_expression?: string;
	priority?: number;
	metadata?: Record<string, any>;
	created_by: "system" | "user";
}

export interface UpdateTaskParams {
	status?: "pending" | "queued" | "running" | "completed" | "failed" | "cancelled";
	attempts?: number;
	last_attempted_at?: string;
	completed_at?: string;
	error_message?: string;
}

export class TaskRepository extends BaseRepository {
	public async createTask(params: CreateTaskParams): Promise<Task | null> {
		const id = generateId();
		const insert = this.buildInsertQuery(
			"tasks",
			{
				id,
				task_type: params.task_type,
				user_id: params.user_id ?? null,
				task_data: params.task_data ? JSON.stringify(params.task_data) : null,
				schedule_type: params.schedule_type ?? "immediate",
				scheduled_at: params.scheduled_at ?? null,
				cron_expression: params.cron_expression ?? null,
				priority: params.priority ?? 5,
				metadata: params.metadata ? JSON.stringify(params.metadata) : null,
				created_by: params.created_by,
				status: "pending",
				attempts: 0,
				max_attempts: 3,
			},
			{ jsonFields: ["task_data", "metadata"], returning: "*" },
		);

		if (!insert) {
			return null;
		}

		return this.runQuery<Task>(insert.query, insert.values, true);
	}

	public async getTaskById(taskId: string): Promise<Task | null> {
		const { query, values } = this.buildSelectQuery("tasks", { id: taskId });
		return this.runQuery<Task>(query, values, true);
	}

	public async getTasksByUserId(
		userId: number,
		limit = 50,
	): Promise<Task[]> {
		const { query, values } = this.buildSelectQuery(
			"tasks",
			{ user_id: userId },
			{ orderBy: "created_at DESC", limit },
		);
		const result = await this.runQuery<Task>(query, values);
		return result || [];
	}

	public async getPendingTasks(limit = 10): Promise<Task[]> {
		const result = await this.runQuery<Task>(
			`SELECT * FROM tasks
       WHERE status IN ('pending', 'queued')
         AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))
       ORDER BY priority DESC, created_at ASC
       LIMIT ?`,
			[limit],
		);
		return result || [];
	}

	public async updateTask(
		taskId: string,
		params: UpdateTaskParams,
	): Promise<Task | null> {
		const fieldsToUpdate = Object.keys(params);

		const update = this.buildUpdateQuery(
			"tasks",
			params as Record<string, unknown>,
			fieldsToUpdate,
			"id = ?",
			[taskId],
			{ returning: "*" },
		);

		if (!update) {
			return null;
		}

		return this.runQuery<Task>(update.query, update.values, true);
	}

	public async deleteTask(taskId: string): Promise<boolean> {
		const { query, values } = this.buildDeleteQuery("tasks", { id: taskId });
		await this.executeRun(query, values);
		return true;
	}

	public async createTaskExecution(
		taskId: string,
		status: "running" | "completed" | "failed",
		errorMessage?: string,
		resultData?: Record<string, any>,
	): Promise<TaskExecution | null> {
		const id = generateId();
		const now = new Date().toISOString();

		const insert = this.buildInsertQuery(
			"task_executions",
			{
				id,
				task_id: taskId,
				status,
				started_at: now,
				completed_at: status !== "running" ? now : null,
				execution_time_ms: null,
				error_message: errorMessage ?? null,
				result_data: resultData ? JSON.stringify(resultData) : null,
			},
			{ jsonFields: ["result_data"], returning: "*" },
		);

		if (!insert) {
			return null;
		}

		return this.runQuery<TaskExecution>(insert.query, insert.values, true);
	}

	public async updateTaskExecution(
		executionId: string,
		status: "running" | "completed" | "failed",
		executionTimeMs?: number,
		errorMessage?: string,
		resultData?: Record<string, any>,
	): Promise<TaskExecution | null> {
		const now = new Date().toISOString();

		const updates = {
			status,
			completed_at: now,
			execution_time_ms: executionTimeMs ?? null,
			error_message: errorMessage ?? null,
			result_data: resultData ? JSON.stringify(resultData) : null,
		};

		const fieldsToUpdate = Object.keys(updates);

		const update = this.buildUpdateQuery(
			"task_executions",
			updates as Record<string, unknown>,
			fieldsToUpdate,
			"id = ?",
			[executionId],
			{ jsonFields: ["result_data"], returning: "*" },
		);

		if (!update) {
			return null;
		}

		return this.runQuery<TaskExecution>(update.query, update.values, true);
	}

	public async getTaskExecutions(taskId: string): Promise<TaskExecution[]> {
		const { query, values } = this.buildSelectQuery(
			"task_executions",
			{ task_id: taskId },
			{ orderBy: "created_at DESC" },
		);
		const result = await this.runQuery<TaskExecution>(query, values);
		return result || [];
	}

	public async getTaskExecutionById(
		executionId: string,
	): Promise<TaskExecution | null> {
		const { query, values } = this.buildSelectQuery("task_executions", {
			id: executionId,
		});
		return this.runQuery<TaskExecution>(query, values, true);
	}
}
