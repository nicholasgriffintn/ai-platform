import type {
  ProjectTask,
  ProjectTaskBlockedReason,
  ProjectTaskConstraints,
  ProjectTaskContext,
  ProjectTaskCriterion,
  ProjectTaskDeliverable,
  ProjectTaskPriority,
  ProjectTaskRunner,
  ProjectTaskSource,
  ProjectTaskStatus,
  ToolPermission,
} from "@ngriffin_uk/polychat-schemas";

import type { ProjectTaskRow } from "~/lib/database/schema";
import { generateId } from "~/utils/id";
import { safeParseJson } from "~/utils/json";

import { BaseRepository } from "./BaseRepository";

export interface CreateProjectTaskParams {
  projectId: string;
  workspaceId: string;
  objective: string;
  acceptance?: string | null;
  acceptanceCriteria?: ProjectTaskCriterion[];
  deliverable?: ProjectTaskDeliverable | null;
  context?: ProjectTaskContext | null;
  constraints?: ProjectTaskConstraints | null;
  dependsOnTaskIds?: string[];
  requireApprovalFor?: ToolPermission[];
  priority?: ProjectTaskPriority;
  dueAt?: string | null;
  source: ProjectTaskSource;
  createdByUserId: number;
  assigneeUserId?: number | null;
  runner?: ProjectTaskRunner | null;
  stageId?: string | null;
  tokenBudget?: number | null;
  position: number;
}

export interface UpdateProjectTaskParams {
  objective?: string;
  acceptance?: string | null;
  acceptanceCriteria?: ProjectTaskCriterion[];
  deliverable?: ProjectTaskDeliverable | null;
  context?: ProjectTaskContext | null;
  constraints?: ProjectTaskConstraints | null;
  dependsOnTaskIds?: string[];
  requireApprovalFor?: ToolPermission[];
  priority?: ProjectTaskPriority;
  dueAt?: string | null;
  status?: ProjectTaskStatus;
  blockedReason?: ProjectTaskBlockedReason | null;
  blockedDetail?: string | null;
  stageId?: string | null;
  runner?: ProjectTaskRunner | null;
  assigneeUserId?: number | null;
  runnerIdentityUserId?: number | null;
  conversationId?: string | null;
  goalId?: string | null;
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
    acceptance: row.acceptance,
    status: row.status,
    source: row.source,
    blockedReason: row.blocked_reason,
    blockedDetail: row.blocked_detail,
    stageId: row.stage_id,
    runner: parseJsonColumn<ProjectTaskRunner>(row.runner),
    acceptanceCriteria: parseJsonColumn<ProjectTaskCriterion[]>(row.acceptance_criteria) ?? [],
    deliverable: parseJsonColumn<ProjectTaskDeliverable>(row.deliverable),
    context: parseJsonColumn<ProjectTaskContext>(row.context),
    constraints: parseJsonColumn<ProjectTaskConstraints>(row.constraints),
    dependsOnTaskIds: parseJsonColumn<string[]>(row.depends_on_task_ids) ?? [],
    requireApprovalFor: parseJsonColumn<ToolPermission[]>(row.require_approval_for) ?? [],
    priority: row.priority,
    dueAt: row.due_at,
    createdByUserId: row.created_by_user_id,
    assigneeUserId: row.assignee_user_id,
    runnerIdentityUserId: row.runner_identity_user_id,
    conversationId: row.conversation_id,
    goalId: row.goal_id,
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
    const row = await this.runQuery<ProjectTaskRow>(
      `INSERT INTO project_task
        (id, project_id, workspace_id, objective, acceptance, acceptance_criteria, deliverable,
         context, constraints, depends_on_task_ids, require_approval_for, priority, due_at,
         status, source, created_by_user_id, assignee_user_id, runner, stage_id, token_budget, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'backlog', ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [
        generateId(),
        params.projectId,
        params.workspaceId,
        params.objective,
        params.acceptance ?? null,
        JSON.stringify(params.acceptanceCriteria ?? []),
        params.deliverable ? JSON.stringify(params.deliverable) : null,
        params.context ? JSON.stringify(params.context) : null,
        params.constraints ? JSON.stringify(params.constraints) : null,
        JSON.stringify(params.dependsOnTaskIds ?? []),
        JSON.stringify(params.requireApprovalFor ?? []),
        params.priority ?? "normal",
        params.dueAt ?? null,
        params.source,
        params.createdByUserId,
        params.assigneeUserId ?? null,
        params.runner ? JSON.stringify(params.runner) : null,
        params.stageId ?? null,
        params.tokenBudget ?? null,
        params.position,
      ],
      true,
    );

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

  async updateTask(taskId: string, updates: UpdateProjectTaskParams): Promise<ProjectTask | null> {
    const columns: string[] = [];
    const values: unknown[] = [];

    const set = (column: string, value: unknown) => {
      columns.push(`${column} = ?`);
      values.push(value);
    };

    if (updates.objective !== undefined) {
      set("objective", updates.objective);
    }

    if (updates.acceptance !== undefined) {
      set("acceptance", updates.acceptance);
    }

    if (updates.acceptanceCriteria !== undefined) {
      set("acceptance_criteria", JSON.stringify(updates.acceptanceCriteria));
    }

    if (updates.deliverable !== undefined) {
      set("deliverable", updates.deliverable ? JSON.stringify(updates.deliverable) : null);
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

    if (updates.priority !== undefined) {
      set("priority", updates.priority);
    }

    if (updates.dueAt !== undefined) {
      set("due_at", updates.dueAt);
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

    if (columns.length === 0) {
      return this.getTaskById(taskId);
    }

    columns.push("updated_at = CURRENT_TIMESTAMP");
    values.push(taskId);

    const row = await this.runQuery<ProjectTaskRow>(
      `UPDATE project_task SET ${columns.join(", ")} WHERE id = ? RETURNING *`,
      values,
      true,
    );

    return row ? formatProjectTask(row) : null;
  }

  async claimQueuedTask(taskId: string, runnerIdentityUserId: number): Promise<ProjectTask | null> {
    const row = await this.runQuery<ProjectTaskRow>(
      `UPDATE project_task
       SET status = 'running',
           runner_identity_user_id = ?,
           blocked_reason = NULL,
           blocked_detail = NULL,
           started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'queued'
       RETURNING *`,
      [runnerIdentityUserId, taskId],
      true,
    );

    return row ? formatProjectTask(row) : null;
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.executeRun("DELETE FROM project_task WHERE id = ?", [taskId]);
  }
}
