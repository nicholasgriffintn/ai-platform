import { recordD1ResultMeta } from "@ngriffin_uk/polychat-ai-billing";
import type { TaskType, ScheduleType, TaskStatus } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { Task, TaskExecution } from "~/infrastructure/database/schema";
import { publishUserEvent } from "~/modules/sync/application/conversation-events";
import type { IEnv } from "~/types";

export interface TaskTypeSummaryRow {
  task_type: string;
  running: number;
  waiting: number;
  scheduled: number;
  suspended: number;
  failed: number;
  completed: number;
  average_turnaround_ms: number | null;
  oldest_open: string | null;
}

export interface TaskOverviewRow {
  id: string;
  task_type: string;
  status: TaskStatus;
  user_id: number | null;
  priority: number;
  attempts: number;
  max_attempts: number;
  scheduled_at: string | null;
  last_attempted_at: string | null;
  completed_at: string | null;
  workflow_instance_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CreateTaskParams {
  id?: string;
  task_type: TaskType;
  user_id?: number;
  project_id?: string;
  task_data?: Record<string, any>;
  schedule_type?: ScheduleType;
  scheduled_at?: string;
  cron_expression?: string;
  priority?: number;
  metadata?: Record<string, any>;
  created_by: "system" | "user";
  status?: "pending" | "suspended";
}

export interface UpdateTaskParams {
  status?: "pending" | "queued" | "running" | "suspended" | "completed" | "failed" | "cancelled";
  workflow_instance_id?: string;
  attempts?: number;
  last_attempted_at?: string;
  completed_at?: string;
  error_message?: string;
}

export class TaskRepository extends BaseRepository<Pick<IEnv, "DB">> {
  private announce(task: Task | null | undefined): void {
    if (task?.user_id) {
      publishUserEvent({ env: this.env }, task.user_id, "task.changed", {
        taskId: task.id,
        status: task.status,
      });
    }
  }

  private parseTask(task: Task): Task {
    return {
      ...task,
      task_data: task.task_data ? safeParseJson(task.task_data) : null,
      metadata: task.metadata ? safeParseJson(task.metadata) : null,
    };
  }

  public async createTask(params: CreateTaskParams): Promise<Task | null> {
    const id = params.id ?? generateId();
    const insert = this.buildInsertQuery(
      "tasks",
      {
        id,
        task_type: params.task_type,
        user_id: params.user_id ?? null,
        project_id: params.project_id ?? null,
        task_data: params.task_data ? JSON.stringify(params.task_data) : null,
        schedule_type: params.schedule_type ?? "immediate",
        scheduled_at: params.scheduled_at ?? null,
        cron_expression: params.cron_expression ?? null,
        priority: params.priority ?? 5,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        created_by: params.created_by,
        status: params.status ?? "pending",
        attempts: 0,
        max_attempts: 3,
      },
      { jsonFields: ["task_data", "metadata"], returning: "*" },
    );

    if (!insert) {
      return null;
    }

    const task = await this.runQuery<Task>(insert.query, insert.values, true);

    if (!task) {
      return null;
    }

    this.announce(task);

    return this.parseTask(task);
  }

  public async createTaskIfAbsent(
    params: CreateTaskParams & { id: string },
  ): Promise<{ task: Task | null; created: boolean }> {
    const [inserted] = await this.runQuery<Task>(
      `INSERT OR IGNORE INTO tasks (
				id, task_type, user_id, project_id, task_data, schedule_type, scheduled_at,
				cron_expression, priority, metadata, created_by, status, attempts, max_attempts
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 3)
			RETURNING *`,
      [
        params.id,
        params.task_type,
        params.user_id ?? null,
        params.project_id ?? null,
        params.task_data ? JSON.stringify(params.task_data) : null,
        params.schedule_type ?? "immediate",
        params.scheduled_at ?? null,
        params.cron_expression ?? null,
        params.priority ?? 5,
        params.metadata ? JSON.stringify(params.metadata) : null,
        params.created_by,
      ],
    );

    if (!inserted) {
      return { task: await this.getTaskById(params.id), created: false };
    }

    this.announce(inserted);

    return { task: this.parseTask(inserted), created: true };
  }

  public async getTaskById(taskId: string): Promise<Task | null> {
    const { query, values } = this.buildSelectQuery("tasks", { id: taskId });
    const result = await this.runQuery<Task>(query, values, true);

    if (!result) {
      return null;
    }

    return this.parseTask(result);
  }

  public async getTasksByUserId(userId: number, limit = 50): Promise<Task[]> {
    const { query, values } = this.buildSelectQuery(
      "tasks",
      { user_id: userId },
      { orderBy: "created_at DESC", limit },
    );
    const result = await this.runQuery<Task>(query, values);

    if (!result) {
      return [];
    }

    return Array.isArray(result) ? result.map((task) => this.parseTask(task)) : [];
  }

  public async summariseTaskTypes(since: Date): Promise<TaskTypeSummaryRow[]> {
    const cutoff = since.toISOString();

    return this.runQuery<TaskTypeSummaryRow>(
      `SELECT task_type,
              SUM(status = 'running') AS running,
              SUM(status IN ('pending', 'queued')
                AND (scheduled_at IS NULL OR datetime(scheduled_at) <= datetime('now'))) AS waiting,
              SUM(status IN ('pending', 'queued')
                AND scheduled_at IS NOT NULL AND datetime(scheduled_at) > datetime('now')) AS scheduled,
              SUM(status = 'suspended') AS suspended,
              SUM(status = 'failed' AND datetime(updated_at) >= datetime(?)) AS failed,
              SUM(status = 'completed' AND datetime(completed_at) >= datetime(?)) AS completed,
              AVG(CASE WHEN status = 'completed' AND datetime(completed_at) >= datetime(?)
                THEN (julianday(completed_at) - julianday(created_at)) * 86400000 END)
                AS average_turnaround_ms,
              MIN(CASE WHEN status IN ('pending', 'queued', 'running') THEN created_at END)
                AS oldest_open
       FROM tasks
       WHERE status IN ('pending', 'queued', 'running', 'suspended')
          OR datetime(updated_at) >= datetime(?)
       GROUP BY task_type
       ORDER BY running DESC, waiting DESC, failed DESC, task_type ASC`,
      [cutoff, cutoff, cutoff, cutoff],
    );
  }

  public async listRecentTasks(params: {
    statuses: readonly TaskStatus[];
    taskType?: string;
    limit: number;
  }): Promise<TaskOverviewRow[]> {
    return this.runQuery<TaskOverviewRow>(
      `SELECT id, task_type, status, user_id, priority, attempts, max_attempts, scheduled_at,
              last_attempted_at, completed_at, workflow_instance_id, error_message, created_at,
              updated_at
       FROM tasks
       WHERE status IN (${params.statuses.map(() => "?").join(", ")})
         AND (? IS NULL OR task_type = ?)
       ORDER BY updated_at DESC
       LIMIT ?`,
      [...params.statuses, params.taskType ?? null, params.taskType ?? null, params.limit],
    );
  }

  public async resetTaskForRetry(taskId: string): Promise<Task | null> {
    const task = await this.runQuery<Task>(
      `UPDATE tasks
       SET status = 'pending', attempts = 0, error_message = NULL, completed_at = NULL,
           execution_owner_token = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status IN ('failed', 'cancelled')
       RETURNING *`,
      [taskId],
      true,
    );

    this.announce(task);

    return task ? this.parseTask(task) : null;
  }

  public async getPendingTasks(limit: number, updatedBefore: Date): Promise<Task[]> {
    const result = await this.runQuery<Task>(
      `SELECT * FROM tasks
       WHERE status = 'pending' AND datetime(updated_at) <= datetime(?)
       ORDER BY priority DESC, created_at ASC
       LIMIT ?`,
      [updatedBefore.toISOString(), limit],
    );

    return result ? result.map((task) => this.parseTask(task)) : [];
  }

  public async updateTask(taskId: string, params: UpdateTaskParams): Promise<Task | null> {
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

    const task = await this.runQuery<Task>(update.query, update.values, true);

    this.announce(task);

    return task;
  }

  public async settleSuspendedRecipeTask(params: {
    taskId: string;
    userId: number;
    status: "completed" | "failed" | "cancelled";
    completedAt: string;
    errorMessage?: string;
  }): Promise<Task | null> {
    const task = await this.runQuery<Task>(
      `UPDATE tasks
       SET status = ?, completed_at = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ? AND task_type = 'recipe_execution' AND status = 'suspended'
       RETURNING *`,
      [
        params.status,
        params.completedAt,
        params.errorMessage ?? null,
        params.taskId,
        params.userId,
      ],
      true,
    );

    this.announce(task);

    return task ? this.parseTask(task) : null;
  }

  public async listSuspendedTasksForConversation(params: {
    taskType: TaskType;
    userId: number;
    conversationId: string;
    limit: number;
  }): Promise<Task[]> {
    const result = await this.runQuery<Task>(
      `SELECT * FROM tasks
       WHERE task_type = ? AND user_id = ? AND status = 'suspended'
         AND json_extract(task_data, '$.conversationId') = ?
       ORDER BY created_at ASC, id ASC
       LIMIT ?`,
      [params.taskType, params.userId, params.conversationId, params.limit],
    );

    return result.map((task) => this.parseTask(task));
  }

  public async listSuspendedTasksUpdatedBefore(params: {
    taskType: TaskType;
    updatedBefore: string;
    limit: number;
  }): Promise<Task[]> {
    const result = await this.runQuery<Task>(
      `SELECT * FROM tasks
       WHERE task_type = ? AND status = 'suspended' AND datetime(updated_at) <= datetime(?)
       ORDER BY created_at ASC, id ASC
       LIMIT ?`,
      [params.taskType, params.updatedBefore, params.limit],
    );

    return result.map((task) => this.parseTask(task));
  }

  public async cancelSuspendedTask(params: {
    taskId: string;
    taskType: TaskType;
    userId: number;
  }): Promise<boolean> {
    const task = await this.runQuery<Task>(
      `UPDATE tasks
       SET status = 'cancelled', completed_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND task_type = ? AND user_id = ? AND status = 'suspended'
       RETURNING *`,
      [new Date().toISOString(), params.taskId, params.taskType, params.userId],
      true,
    );

    this.announce(task);

    return Boolean(task);
  }

  public async releaseNextSuspendedTaskForConversation(params: {
    taskType: TaskType;
    conversationId: string;
  }): Promise<Task | null> {
    const task = await this.runQuery<Task>(
      `UPDATE tasks
       SET status = 'pending', updated_at = CURRENT_TIMESTAMP
       WHERE id = (
         SELECT id FROM tasks
         WHERE task_type = ? AND status = 'suspended'
           AND json_extract(task_data, '$.conversationId') = ?
         ORDER BY created_at ASC, id ASC
         LIMIT 1
       )
       AND NOT EXISTS (
         SELECT 1 FROM tasks
         WHERE task_type = ? AND status IN ('pending', 'queued', 'running')
           AND json_extract(task_data, '$.conversationId') = ?
       )
       RETURNING *`,
      [params.taskType, params.conversationId, params.taskType, params.conversationId],
      true,
    );

    this.announce(task);

    return task ? this.parseTask(task) : null;
  }

  public async claimTaskForExecution(
    taskId: string,
    options: { ownerToken: string; instanceId: string },
  ): Promise<Task | null> {
    const instancePrefix = `${options.instanceId}:`;
    const task = await this.runQuery<Task>(
      `UPDATE tasks
       SET status = 'running',
           last_attempted_at = ?,
           execution_owner_token = ?
       WHERE id = ?
         AND (
           status IN ('pending', 'queued')
           OR (status = 'running' AND substr(execution_owner_token, 1, length(?)) = ?)
         )
       RETURNING *`,
      [new Date().toISOString(), options.ownerToken, taskId, instancePrefix, instancePrefix],
      true,
    );

    return task ? this.parseTask(task) : null;
  }

  public async isTaskExecutionOwner(params: {
    taskId: string;
    ownerToken: string;
  }): Promise<boolean> {
    const row = await this.runQuery<{ owned: number }>(
      `SELECT 1 AS owned FROM tasks
       WHERE id = ? AND status = 'running' AND execution_owner_token = ?`,
      [params.taskId, params.ownerToken],
      true,
    );

    return row?.owned === 1;
  }

  public async updateOwnedTask(
    taskId: string,
    ownerToken: string,
    params: UpdateTaskParams,
  ): Promise<Task | null> {
    const updates = { ...params, execution_owner_token: null };
    const update = this.buildUpdateQuery(
      "tasks",
      updates,
      Object.keys(updates),
      "id = ? AND status = 'running' AND execution_owner_token = ?",
      [taskId, ownerToken],
      { returning: "*" },
    );

    if (!update) {
      return null;
    }

    const task = await this.runQuery<Task>(update.query, update.values, true);

    this.announce(task);

    return task ? this.parseTask(task) : null;
  }

  public async failOpenTask(taskId: string, errorMessage: string): Promise<void> {
    const task = await this.runQuery<Task>(
      `UPDATE tasks
       SET status = 'failed', execution_owner_token = NULL, error_message = ?, completed_at = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status IN ('pending', 'queued', 'running')
       RETURNING *`,
      [errorMessage, new Date().toISOString(), taskId],
      true,
    );

    this.announce(task);
  }

  public async listOpenWorkflowTasksUpdatedBefore(cutoff: Date): Promise<Task[]> {
    const result = await this.runQuery<Task>(
      `SELECT * FROM tasks
       WHERE status IN ('queued', 'running')
         AND workflow_instance_id IS NOT NULL
         AND datetime(updated_at) < datetime(?)
       ORDER BY created_at ASC`,
      [cutoff.toISOString()],
    );

    return result.map((task) => this.parseTask(task));
  }

  public async sampleDueWorkflowTasks(updatedBefore: Date, limit: number): Promise<Task[]> {
    const result = await this.runQuery<Task>(
      `SELECT * FROM tasks
       WHERE status IN ('queued', 'running')
         AND workflow_instance_id IS NOT NULL
         AND datetime(updated_at) < datetime(?)
         AND (scheduled_at IS NULL OR datetime(scheduled_at) < datetime(?))
       ORDER BY RANDOM()
       LIMIT ?`,
      [updatedBefore.toISOString(), updatedBefore.toISOString(), limit],
    );

    return result.map((task) => this.parseTask(task));
  }

  public async requeueErroredWorkflowTask(taskId: string, instanceId: string): Promise<boolean> {
    const task = await this.runQuery<Task>(
      `UPDATE tasks
       SET status = 'pending', attempts = attempts + 1, execution_owner_token = NULL,
           workflow_instance_id = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND workflow_instance_id = ? AND status IN ('queued', 'running')
         AND attempts + 1 < max_attempts
       RETURNING *`,
      [taskId, instanceId],
      true,
    );

    this.announce(task);

    return task !== null;
  }

  public async findRunningExecutionStep(taskId: string): Promise<string | null> {
    const row = await this.runQuery<{ step: string | null }>(
      `SELECT step FROM task_executions
       WHERE task_id = ? AND status = 'running'
       ORDER BY started_at DESC
       LIMIT 1`,
      [taskId],
      true,
    );

    return row?.step ?? null;
  }

  public async failRunningTaskExecutions(taskId: string, reason: string): Promise<void> {
    await this.executeRun(
      `UPDATE task_executions
       SET status = 'failed',
           completed_at = ?,
           error_message = ?
       WHERE task_id = ? AND status = 'running'`,
      [new Date().toISOString(), reason, taskId],
    );
  }

  public async deleteTask(taskId: string): Promise<boolean> {
    const task = await this.getTaskById(taskId);
    const { query, values } = this.buildDeleteQuery("tasks", { id: taskId });

    await this.executeRun(query, values);
    this.announce(task);

    return true;
  }

  public async deleteSettledTasksBefore(cutoff: Date, limit: number): Promise<number> {
    const selection = `SELECT id FROM tasks
       WHERE status IN ('completed', 'cancelled')
         AND schedule_type = 'immediate'
         AND datetime(COALESCE(completed_at, updated_at, created_at)) < datetime(?)
       LIMIT ?`;
    const bindings = [cutoff.toISOString(), limit];
    const [executions, tasksDeleted] = await this.env.DB.batch([
      this.env.DB.prepare(`DELETE FROM task_executions WHERE task_id IN (${selection})`).bind(
        ...bindings,
      ),
      this.env.DB.prepare(`DELETE FROM tasks WHERE id IN (${selection})`).bind(...bindings),
    ]);

    recordD1ResultMeta(executions?.meta);
    recordD1ResultMeta(tasksDeleted?.meta);

    return tasksDeleted?.meta?.changes ?? 0;
  }

  public async createTaskExecution(taskId: string, step: string): Promise<TaskExecution | null> {
    const insert = this.buildInsertQuery(
      "task_executions",
      {
        id: generateId(),
        task_id: taskId,
        status: "running",
        step,
        started_at: new Date().toISOString(),
        completed_at: null,
        execution_time_ms: null,
        error_message: null,
        result_data: null,
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
      updates,
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

  public async getTaskExecutionById(executionId: string): Promise<TaskExecution | null> {
    const { query, values } = this.buildSelectQuery("task_executions", {
      id: executionId,
    });

    return this.runQuery<TaskExecution>(query, values, true);
  }
}
