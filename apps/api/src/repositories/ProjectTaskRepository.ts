import {
  PROJECT_TASK_DEFAULT_CONCURRENCY,
  type ProjectTask,
  type ProjectTaskBlockedReason,
  type ProjectTaskCompletion,
  type ProjectTaskConstraints,
  type ProjectTaskContext,
  type ProjectTaskCriterion,
  type ProjectTaskRunner,
  type ProjectTaskSource,
  type ProjectTaskStatus,
  type ToolPermission,
} from "@ngriffin_uk/polychat-schemas";

import type { ProjectTaskRow } from "~/lib/database/schema";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { safeParseJson } from "~/utils/json";

import { BaseRepository } from "./BaseRepository";

const SANDBOX_PROJECTION_LEASE_MODIFIER = "-5 minutes";

export interface CreateProjectTaskParams {
  projectId: string;
  workspaceId: string;
  objective: string;
  acceptanceCriteria?: ProjectTaskCriterion[];
  expectedOutput?: string | null;
  context?: ProjectTaskContext | null;
  constraints?: ProjectTaskConstraints | null;
  dependsOnTaskIds?: string[];
  requireApprovalFor?: ToolPermission[];
  source: ProjectTaskSource;
  createdByUserId: number;
  assigneeUserId?: number | null;
  runner?: ProjectTaskRunner | null;
  stageId?: string | null;
  tokenBudget?: number | null;
  idempotencyKey?: string | null;
  position: number;
}

export interface UpdateProjectTaskParams {
  objective?: string;
  acceptanceCriteria?: ProjectTaskCriterion[];
  expectedOutput?: string | null;
  context?: ProjectTaskContext | null;
  constraints?: ProjectTaskConstraints | null;
  dependsOnTaskIds?: string[];
  requireApprovalFor?: ToolPermission[];
  status?: ProjectTaskStatus;
  blockedReason?: ProjectTaskBlockedReason | null;
  blockedDetail?: string | null;
  stageId?: string | null;
  runner?: ProjectTaskRunner | null;
  assigneeUserId?: number | null;
  runnerIdentityUserId?: number | null;
  conversationId?: string | null;
  goalId?: string | null;
  dispatchTaskId?: string | null;
  sandboxRunId?: string | null;
  outputId?: string | null;
  completions?: ProjectTaskCompletion[];
  position?: number;
  tokenBudget?: number | null;
  tokensSpent?: number;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface ListProjectTaskFilters {
  status?: ProjectTaskStatus;
  assigneeUserId?: number;
  includeDone?: boolean;
}

function parseJsonColumn<T>(value: unknown): T | null {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === "string" ? safeParseJson<T>(value) : (value as T);
}

function formatProjectTask(row: ProjectTaskRow): ProjectTask {
  return {
    id: row.id,
    projectId: row.project_id,
    workspaceId: row.workspace_id,
    objective: row.objective,
    status: row.status,
    source: row.source,
    blockedReason: row.blocked_reason,
    blockedDetail: row.blocked_detail,
    stageId: row.stage_id,
    runner: parseJsonColumn<ProjectTaskRunner>(row.runner),
    acceptanceCriteria: parseJsonColumn<ProjectTaskCriterion[]>(row.acceptance_criteria) ?? [],
    expectedOutput: row.expected_output,
    context: parseJsonColumn<ProjectTaskContext>(row.context),
    constraints: parseJsonColumn<ProjectTaskConstraints>(row.constraints),
    dependsOnTaskIds: parseJsonColumn<string[]>(row.depends_on_task_ids) ?? [],
    requireApprovalFor: parseJsonColumn<ToolPermission[]>(row.require_approval_for) ?? [],
    createdByUserId: row.created_by_user_id,
    assigneeUserId: row.assignee_user_id,
    runnerIdentityUserId: row.runner_identity_user_id,
    conversationId: row.conversation_id,
    goalId: row.goal_id,
    dispatchTaskId: row.dispatch_task_id,
    sandboxRunId: row.sandbox_run_id,
    outputId: row.output_id,
    completions: parseJsonColumn<ProjectTaskCompletion[]>(row.completions) ?? [],
    position: row.position,
    tokenBudget: row.token_budget,
    tokensSpent: row.tokens_spent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

export class ProjectTaskRepository extends BaseRepository {
  async createTask(params: CreateProjectTaskParams): Promise<ProjectTask> {
    const insert = this.buildInsertQuery(
      "project_task",
      {
        id: generateId(),
        project_id: params.projectId,
        workspace_id: params.workspaceId,
        objective: params.objective,
        acceptance_criteria: params.acceptanceCriteria ?? [],
        expected_output: params.expectedOutput ?? null,
        context: params.context ?? null,
        constraints: params.constraints ?? null,
        depends_on_task_ids: params.dependsOnTaskIds ?? [],
        require_approval_for: params.requireApprovalFor ?? [],
        completions: [],
        status: "backlog",
        source: params.source,
        created_by_user_id: params.createdByUserId,
        assignee_user_id: params.assigneeUserId ?? null,
        runner: params.runner ?? null,
        stage_id: params.stageId ?? null,
        token_budget: params.tokenBudget ?? null,
        idempotency_key: params.idempotencyKey ?? null,
        position: params.position,
      },
      {
        jsonFields: [
          "acceptance_criteria",
          "context",
          "constraints",
          "depends_on_task_ids",
          "require_approval_for",
          "completions",
          "runner",
        ],
        returning: "*",
      },
    );

    if (!insert) {
      throw new AssistantError("Failed to build the task insert", ErrorType.INTERNAL_ERROR);
    }

    const row = await this.runQuery<ProjectTaskRow>(insert.query, insert.values, true);

    if (!row) {
      throw new AssistantError("Failed to create the task", ErrorType.DATABASE_ERROR);
    }

    return formatProjectTask(row);
  }

  async getTaskById(taskId: string): Promise<ProjectTask | null> {
    const row = await this.runQuery<ProjectTaskRow>(
      "SELECT * FROM project_task WHERE id = ?",
      [taskId],
      true,
    );

    return row ? formatProjectTask(row) : null;
  }

  async getTaskByIdempotencyKey(params: {
    projectId: string;
    createdByUserId: number;
    idempotencyKey: string;
  }): Promise<ProjectTask | null> {
    const row = await this.runQuery<ProjectTaskRow>(
      `SELECT * FROM project_task
       WHERE project_id = ? AND created_by_user_id = ? AND idempotency_key = ?`,
      [params.projectId, params.createdByUserId, params.idempotencyKey],
      true,
    );

    return row ? formatProjectTask(row) : null;
  }

  async getTaskByConversation(conversationId: string): Promise<ProjectTask | null> {
    const row = await this.runQuery<ProjectTaskRow>(
      "SELECT * FROM project_task WHERE conversation_id = ?",
      [conversationId],
      true,
    );

    return row ? formatProjectTask(row) : null;
  }

  async listProjectTasks(
    projectId: string,
    filters: ListProjectTaskFilters = {},
  ): Promise<ProjectTask[]> {
    const conditions = ["project_id = ?"];
    const values: unknown[] = [projectId];

    if (filters.status) {
      conditions.push("status = ?");
      values.push(filters.status);
    } else if (!filters.includeDone) {
      conditions.push("status != 'cancelled'");
    }

    if (filters.assigneeUserId) {
      conditions.push("assignee_user_id = ?");
      values.push(filters.assigneeUserId);
    }

    const rows = await this.runQuery<ProjectTaskRow>(
      `SELECT * FROM project_task
       WHERE ${conditions.join(" AND ")}
       ORDER BY position ASC, created_at ASC`,
      values,
    );

    return rows.map(formatProjectTask);
  }

  async listAttentionTasks(
    workspaceIds: readonly string[],
    userId: number,
    limit: number,
  ): Promise<ProjectTask[]> {
    if (workspaceIds.length === 0) {
      return [];
    }

    const placeholders = workspaceIds.map(() => "?").join(", ");
    const rows = await this.runQuery<ProjectTaskRow>(
      `SELECT * FROM project_task
       WHERE workspace_id IN (${placeholders})
         AND (
           status IN ('blocked', 'review')
           OR (status = 'backlog' AND assignee_user_id = ?)
         )
       ORDER BY updated_at DESC, created_at DESC
       LIMIT ?`,
      [...workspaceIds, userId, limit],
    );

    return rows.map(formatProjectTask);
  }

  async countActiveTasks(projectId: string, excludeTaskId?: string): Promise<number> {
    const row = await this.runQuery<{ total: number }>(
      `SELECT COUNT(*) AS total FROM project_task
       WHERE project_id = ?
         AND status IN ('queued', 'running')
         AND (? IS NULL OR id != ?)`,
      [projectId, excludeTaskId ?? null, excludeTaskId ?? null],
      true,
    );

    return row?.total ?? 0;
  }

  async getMaxPosition(projectId: string): Promise<number> {
    const row = await this.runQuery<{ max_position: number | null }>(
      "SELECT MAX(position) AS max_position FROM project_task WHERE project_id = ?",
      [projectId],
      true,
    );

    return row?.max_position ?? 0;
  }

  async updateTask(
    taskId: string,
    updates: UpdateProjectTaskParams,
    options: {
      expectedStatuses?: readonly ProjectTaskStatus[];
      requireProjectionUnclaimed?: boolean;
    } = {},
  ): Promise<ProjectTask | null> {
    const columns: string[] = [];
    const values: unknown[] = [];

    const set = (column: string, value: unknown) => {
      columns.push(`${column} = ?`);
      values.push(value);
    };

    if (updates.objective !== undefined) {
      set("objective", updates.objective);
    }

    if (updates.acceptanceCriteria !== undefined) {
      set("acceptance_criteria", JSON.stringify(updates.acceptanceCriteria));
    }

    if (updates.expectedOutput !== undefined) {
      set("expected_output", updates.expectedOutput);
    }

    if (updates.context !== undefined) {
      set("context", updates.context ? JSON.stringify(updates.context) : null);
    }

    if (updates.constraints !== undefined) {
      set("constraints", updates.constraints ? JSON.stringify(updates.constraints) : null);
    }

    if (updates.dependsOnTaskIds !== undefined) {
      set("depends_on_task_ids", JSON.stringify(updates.dependsOnTaskIds));
    }

    if (updates.requireApprovalFor !== undefined) {
      set("require_approval_for", JSON.stringify(updates.requireApprovalFor));
    }

    if (updates.status !== undefined) {
      set("status", updates.status);
    }

    if (updates.blockedReason !== undefined) {
      set("blocked_reason", updates.blockedReason);
    }

    if (updates.blockedDetail !== undefined) {
      set("blocked_detail", updates.blockedDetail);
    }

    if (updates.stageId !== undefined) {
      set("stage_id", updates.stageId);
    }

    if (updates.runner !== undefined) {
      set("runner", updates.runner ? JSON.stringify(updates.runner) : null);
    }

    if (updates.assigneeUserId !== undefined) {
      set("assignee_user_id", updates.assigneeUserId);
    }

    if (updates.runnerIdentityUserId !== undefined) {
      set("runner_identity_user_id", updates.runnerIdentityUserId);
    }

    if (updates.conversationId !== undefined) {
      set("conversation_id", updates.conversationId);
    }

    if (updates.goalId !== undefined) {
      set("goal_id", updates.goalId);
    }

    if (updates.dispatchTaskId !== undefined) {
      set("dispatch_task_id", updates.dispatchTaskId);
    }

    if (updates.sandboxRunId !== undefined) {
      set("sandbox_run_id", updates.sandboxRunId);
    }

    if (updates.outputId !== undefined) {
      set("output_id", updates.outputId);
    }

    if (updates.completions !== undefined) {
      set("completions", JSON.stringify(updates.completions));
    }

    if (updates.position !== undefined) {
      set("position", updates.position);
    }

    if (updates.tokenBudget !== undefined) {
      set("token_budget", updates.tokenBudget);
    }

    if (updates.tokensSpent !== undefined) {
      set("tokens_spent", updates.tokensSpent);
    }

    if (updates.startedAt !== undefined) {
      set("started_at", updates.startedAt);
    }

    if (updates.completedAt !== undefined) {
      set("completed_at", updates.completedAt);
    }

    if (updates.status === "cancelled" && options.requireProjectionUnclaimed) {
      set("projection_claim_id", null);
    }

    if (columns.length === 0) {
      return this.getTaskById(taskId);
    }

    columns.push("updated_at = CURRENT_TIMESTAMP");
    values.push(taskId);

    if (options.expectedStatuses?.length) {
      values.push(...options.expectedStatuses);
    }

    if (options.requireProjectionUnclaimed) {
      values.push(SANDBOX_PROJECTION_LEASE_MODIFIER);
    }

    const expectedStatusClause = options.expectedStatuses?.length
      ? ` AND status IN (${options.expectedStatuses.map(() => "?").join(", ")})`
      : "";
    const projectionClaimClause = options.requireProjectionUnclaimed
      ? " AND (projection_claim_id IS NULL OR datetime(updated_at) <= datetime('now', ?))"
      : "";

    const row = await this.runQuery<ProjectTaskRow>(
      `UPDATE project_task SET ${columns.join(", ")} WHERE id = ?${expectedStatusClause}${projectionClaimClause} RETURNING *`,
      values,
      true,
    );

    return row ? formatProjectTask(row) : null;
  }

  async queueTaskForRun(params: {
    taskId: string;
    projectId: string;
    runnerIdentityUserId: number;
    dispatchTaskId: string;
    runner: ProjectTaskRunner;
    tokenBudget: number;
    stageId?: string | null;
  }): Promise<ProjectTask | null> {
    const row = await this.runQuery<ProjectTaskRow>(
      `UPDATE project_task
       SET status = 'queued',
           runner_identity_user_id = ?,
           dispatch_task_id = ?,
           runner = ?,
           token_budget = ?,
           stage_id = ?,
           goal_id = NULL,
           sandbox_run_id = NULL,
           output_id = NULL,
           projection_claim_id = NULL,
           blocked_reason = NULL,
           blocked_detail = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND project_id = ?
         AND (
           status IN ('backlog', 'blocked', 'review')
           OR (status = 'queued' AND dispatch_task_id IS NULL)
         )
         AND (
           SELECT COUNT(*)
           FROM project_task AS active_task
           WHERE active_task.project_id = ?
             AND active_task.id != ?
             AND active_task.status IN ('queued', 'running')
         ) < ?
       RETURNING *`,
      [
        params.runnerIdentityUserId,
        params.dispatchTaskId,
        JSON.stringify(params.runner),
        params.tokenBudget,
        params.stageId === undefined ? null : params.stageId,
        params.taskId,
        params.projectId,
        params.projectId,
        params.taskId,
        PROJECT_TASK_DEFAULT_CONCURRENCY,
      ],
      true,
    );

    return row ? formatProjectTask(row) : null;
  }

  async claimQueuedTask(params: {
    taskId: string;
    projectId: string;
    runnerIdentityUserId: number;
    dispatchTaskId: string;
    resumeInterrupted?: boolean;
  }): Promise<ProjectTask | null> {
    const row = await this.runQuery<ProjectTaskRow>(
      `UPDATE project_task
       SET status = 'running',
           blocked_reason = NULL,
           blocked_detail = NULL,
           started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND project_id = ?
         AND runner_identity_user_id = ?
         AND dispatch_task_id = ?
         AND (status = 'queued' OR (? = 1 AND status = 'running'))
       RETURNING *`,
      [
        params.taskId,
        params.projectId,
        params.runnerIdentityUserId,
        params.dispatchTaskId,
        params.resumeInterrupted ? 1 : 0,
      ],
      true,
    );

    return row ? formatProjectTask(row) : null;
  }

  async attachSandboxRun(params: {
    taskId: string;
    projectId: string;
    workspaceId: string;
    runnerIdentityUserId: number;
    dispatchTaskId: string;
    sandboxRunId: string;
    goalId: string;
  }): Promise<ProjectTask | null> {
    const row = await this.runQuery<ProjectTaskRow>(
      `UPDATE project_task
       SET sandbox_run_id = ?,
           goal_id = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND project_id = ?
         AND workspace_id = ?
         AND runner_identity_user_id = ?
         AND dispatch_task_id = ?
         AND status = 'running'
         AND sandbox_run_id IS NULL
         AND output_id IS NULL
       RETURNING *`,
      [
        params.sandboxRunId,
        params.goalId,
        params.taskId,
        params.projectId,
        params.workspaceId,
        params.runnerIdentityUserId,
        params.dispatchTaskId,
      ],
      true,
    );

    return row ? formatProjectTask(row) : null;
  }

  async projectSandboxRunResult(params: {
    taskId: string;
    projectId: string;
    workspaceId: string;
    runnerIdentityUserId: number;
    dispatchTaskId: string;
    sandboxRunId: string;
    goalId: string;
    outputId: string | null;
    status: Extract<ProjectTaskStatus, "blocked" | "review" | "cancelled">;
    blockedReason: ProjectTaskBlockedReason | null;
    blockedDetail: string | null;
    completions: ProjectTaskCompletion[];
    tokensSpent: number;
    completedAt?: string | null;
    projectionClaimId: string;
  }): Promise<ProjectTask | null> {
    const row = await this.runQuery<ProjectTaskRow>(
      `UPDATE project_task
       SET status = ?,
           blocked_reason = ?,
           blocked_detail = ?,
           output_id = ?,
           completions = ?,
           tokens_spent = ?,
           completed_at = ?,
           projection_claim_id = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND project_id = ?
         AND workspace_id = ?
         AND runner_identity_user_id = ?
         AND dispatch_task_id = ?
         AND sandbox_run_id = ?
         AND goal_id = ?
         AND projection_claim_id = ?
         AND status = 'running'
         AND output_id IS NULL
       RETURNING *`,
      [
        params.status,
        params.blockedReason,
        params.blockedDetail?.slice(0, 500) ?? null,
        params.outputId,
        JSON.stringify(params.completions),
        params.tokensSpent,
        params.completedAt ?? null,
        params.taskId,
        params.projectId,
        params.workspaceId,
        params.runnerIdentityUserId,
        params.dispatchTaskId,
        params.sandboxRunId,
        params.goalId,
        params.projectionClaimId,
      ],
      true,
    );

    return row ? formatProjectTask(row) : null;
  }

  async claimSandboxRunProjection(params: {
    taskId: string;
    projectId: string;
    workspaceId: string;
    runnerIdentityUserId: number;
    dispatchTaskId: string;
    sandboxRunId: string;
    goalId: string;
    projectionClaimId: string;
  }): Promise<boolean> {
    const row = await this.runQuery<{ id: string }>(
      `UPDATE project_task
       SET projection_claim_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND project_id = ?
         AND workspace_id = ?
         AND runner_identity_user_id = ?
         AND dispatch_task_id = ?
         AND sandbox_run_id = ?
         AND goal_id = ?
         AND status = 'running'
         AND output_id IS NULL
         AND (
           projection_claim_id IS NULL
           OR datetime(updated_at) <= datetime('now', ?)
         )
       RETURNING id`,
      [
        params.projectionClaimId,
        params.taskId,
        params.projectId,
        params.workspaceId,
        params.runnerIdentityUserId,
        params.dispatchTaskId,
        params.sandboxRunId,
        params.goalId,
        SANDBOX_PROJECTION_LEASE_MODIFIER,
      ],
      true,
    );

    return Boolean(row);
  }

  async releaseSandboxRunProjection(params: {
    taskId: string;
    projectId: string;
    workspaceId: string;
    runnerIdentityUserId: number;
    dispatchTaskId: string;
    sandboxRunId: string;
    goalId: string;
    projectionClaimId: string;
  }): Promise<boolean> {
    const row = await this.runQuery<{ id: string }>(
      `UPDATE project_task
       SET projection_claim_id = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND project_id = ?
         AND workspace_id = ?
         AND runner_identity_user_id = ?
         AND dispatch_task_id = ?
         AND sandbox_run_id = ?
         AND goal_id = ?
         AND projection_claim_id = ?
         AND status = 'running'
         AND output_id IS NULL
       RETURNING id`,
      [
        params.taskId,
        params.projectId,
        params.workspaceId,
        params.runnerIdentityUserId,
        params.dispatchTaskId,
        params.sandboxRunId,
        params.goalId,
        params.projectionClaimId,
      ],
      true,
    );

    return Boolean(row);
  }

  async failDispatch(params: {
    taskId: string;
    projectId: string;
    dispatchTaskId: string;
    detail: string;
  }): Promise<ProjectTask | null> {
    const row = await this.runQuery<ProjectTaskRow>(
      `UPDATE project_task
       SET status = 'blocked',
           blocked_reason = 'dispatch_failed',
           blocked_detail = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND project_id = ? AND dispatch_task_id = ? AND status = 'queued'
       RETURNING *`,
      [params.detail.slice(0, 500), params.taskId, params.projectId, params.dispatchTaskId],
      true,
    );

    return row ? formatProjectTask(row) : null;
  }

  async deleteTask(taskId: string, expectedStatus: ProjectTaskStatus): Promise<boolean> {
    const deleted = await this.runQuery<{ id: string }>(
      "DELETE FROM project_task WHERE id = ? AND status = ? RETURNING id",
      [taskId, expectedStatus],
      true,
    );

    return Boolean(deleted);
  }
}
