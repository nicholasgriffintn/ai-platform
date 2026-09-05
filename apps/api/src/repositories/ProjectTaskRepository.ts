import type {
  ProjectTask,
  ProjectTaskBlockedReason,
  ProjectTaskCompletion,
  ProjectTaskConstraints,
  ProjectTaskContext,
  ProjectTaskCriterion,
  ProjectFlow,
  ProjectTaskRunner,
  ProjectTaskSource,
  ProjectTaskStatus,
  ToolPermission,
} from "@ngriffin_uk/polychat-schemas";

import type { ProjectTaskRow } from "~/lib/database/schema";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { safeParseJson } from "~/utils/json";

import { BaseRepository } from "./BaseRepository";

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
  flowSnapshot?: ProjectFlow | null;
  tokenBudget?: number | null;
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
  runId?: string | null;
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

function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) {
    return fallback;
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
    flowSnapshot: parseJsonColumn<ProjectFlow | null>(row.flow_snapshot, null),
    runner: parseJsonColumn<ProjectTaskRunner | null>(row.runner, null),
    acceptanceCriteria: parseJsonColumn<ProjectTaskCriterion[]>(row.acceptance_criteria, []),
    expectedOutput: row.expected_output,
    context: parseJsonColumn<ProjectTaskContext | null>(row.context, null),
    constraints: parseJsonColumn<ProjectTaskConstraints | null>(row.constraints, null),
    dependsOnTaskIds: parseJsonColumn<string[]>(row.depends_on_task_ids, []),
    requireApprovalFor: parseJsonColumn<ToolPermission[]>(row.require_approval_for, []),
    createdByUserId: row.created_by_user_id,
    assigneeUserId: row.assignee_user_id,
    runnerIdentityUserId: row.runner_identity_user_id,
    conversationId: row.conversation_id,
    goalId: row.goal_id,
    dispatchTaskId: row.dispatch_task_id,
    runId: row.run_id,
    completions: parseJsonColumn<ProjectTaskCompletion[]>(row.completions, []),
    position: row.position,
    tokenBudget: row.token_budget,
    tokensSpent: row.tokens_spent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    attentionVersion: row.attention_version,
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
        flow_snapshot: params.flowSnapshot ?? null,
        token_budget: params.tokenBudget ?? null,
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
          "flow_snapshot",
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

  async countActiveTasks(projectId: string): Promise<number> {
    const row = await this.runQuery<{ total: number }>(
      `SELECT COUNT(*) AS total FROM project_task
       WHERE project_id = ? AND status IN ('queued', 'running')`,
      [projectId],
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
    executionOwner?: { dispatchTaskId: string; ownerToken: string; now?: string },
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

    if (updates.runId !== undefined) {
      set("run_id", updates.runId);
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

    const attentionChanges: Array<[string, unknown]> = [];

    if (updates.status !== undefined) {
      attentionChanges.push(["status", updates.status]);
    }

    if (updates.blockedReason !== undefined) {
      attentionChanges.push(["blocked_reason", updates.blockedReason]);
    }

    if (updates.blockedDetail !== undefined) {
      attentionChanges.push(["blocked_detail", updates.blockedDetail]);
    }

    if (updates.assigneeUserId !== undefined) {
      attentionChanges.push(["assignee_user_id", updates.assigneeUserId]);
    }

    if (updates.completedAt !== undefined) {
      attentionChanges.push(["completed_at", updates.completedAt]);
    }

    if (attentionChanges.length > 0) {
      columns.push(
        `attention_version = attention_version + CASE WHEN ${attentionChanges
          .map(([column]) => `${column} IS NOT ?`)
          .join(" OR ")} THEN 1 ELSE 0 END`,
      );
      values.push(...attentionChanges.map(([, value]) => value));
    }

    if (columns.length === 0) {
      return this.getTaskById(taskId);
    }

    columns.push("updated_at = CURRENT_TIMESTAMP");
    values.push(taskId);

    let ownershipClause = "";

    if (executionOwner) {
      ownershipClause = `
        AND dispatch_task_id = ?
        AND EXISTS (
          SELECT 1 FROM tasks
          WHERE tasks.id = ?
            AND tasks.status = 'running'
            AND tasks.execution_owner_token = ?
            AND datetime(tasks.execution_lease_expires_at) > datetime(?)
        )`;
      values.push(
        executionOwner.dispatchTaskId,
        executionOwner.dispatchTaskId,
        executionOwner.ownerToken,
        executionOwner.now ?? new Date().toISOString(),
      );
    }

    const row = await this.runQuery<ProjectTaskRow>(
      `UPDATE project_task SET ${columns.join(", ")} WHERE id = ?${ownershipClause} RETURNING *`,
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
           stage_id = COALESCE(?, stage_id),
           goal_id = NULL,
           blocked_reason = NULL,
           blocked_detail = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND project_id = ?
         AND status IN ('backlog', 'queued', 'blocked', 'review', 'running')
       RETURNING *`,
      [
        params.runnerIdentityUserId,
        params.dispatchTaskId,
        JSON.stringify(params.runner),
        params.tokenBudget,
        params.stageId ?? null,
        params.taskId,
        params.projectId,
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
    executionOwnerToken: string;
    resumeInterrupted?: boolean;
    now?: string;
  }): Promise<ProjectTask | null> {
    const now = params.now ?? new Date().toISOString();
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
         AND EXISTS (
           SELECT 1 FROM tasks
           WHERE tasks.id = ?
             AND tasks.status = 'running'
             AND tasks.execution_owner_token = ?
             AND datetime(tasks.execution_lease_expires_at) > datetime(?)
         )
       RETURNING *`,
      [
        params.taskId,
        params.projectId,
        params.runnerIdentityUserId,
        params.dispatchTaskId,
        params.resumeInterrupted ? 1 : 0,
        params.dispatchTaskId,
        params.executionOwnerToken,
        now,
      ],
      true,
    );

    return row ? formatProjectTask(row) : null;
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
       WHERE id = ? AND project_id = ? AND dispatch_task_id = ?
       RETURNING *`,
      [params.detail.slice(0, 500), params.taskId, params.projectId, params.dispatchTaskId],
      true,
    );

    return row ? formatProjectTask(row) : null;
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.executeRun("DELETE FROM project_task WHERE id = ?", [taskId]);
  }
}
