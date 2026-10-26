import type {
  ProjectTask,
  ProjectTaskDetails,
  ProjectTaskKind,
  ProjectTaskLink,
  ProjectTaskLinkKind,
  ProjectTaskPriority,
  WorkActor,
  ProjectTaskAssumption,
  ProjectTaskBlockedReason,
  ProjectTaskCompletion,
  ProjectTaskConstraints,
  ProjectTaskContext,
  ProjectTaskCriterion,
  ProjectTaskKillCondition,
  ProjectTaskRetrospective,
  ProjectFlow,
  ProjectTaskRunner,
  ProjectTaskSource,
  ProjectTaskStatus,
  ToolPermission,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonColumn } from "@ngriffin_uk/polychat-utility-server/json";
import { escapeSqlLikePattern } from "@ngriffin_uk/polychat-utility-server/sql";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { ProjectTaskLinkRow, ProjectTaskRow } from "~/infrastructure/database/schema";
import { publishProjectEvent } from "~/modules/sync/application/conversation-events";

export interface GlobalTaskSearchRow {
  id: string;
  key: string | null;
  objective: string;
  status: string;
  project_id: string;
  project_name: string;
  workspace_id: string;
  updated_at: string | null;
}

export interface CreateProjectTaskParams {
  id?: string;
  executionProfile?: "diff_review";
  projectId: string;
  workspaceId: string;
  objective: string;
  acceptanceCriteria?: ProjectTaskCriterion[];
  assumptions?: ProjectTaskAssumption[];
  killConditions?: ProjectTaskKillCondition[];
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
  originConversationId?: string | null;
  position: number;
  number?: number | null;
  key?: string | null;
  kind?: ProjectTaskKind;
  description?: string | null;
  priority?: ProjectTaskPriority;
  parentTaskId?: string | null;
  startAt?: string | null;
  dueAt?: string | null;
  reviewer?: WorkActor | null;
  details?: ProjectTaskDetails | null;
}

export interface UpdateProjectTaskParams {
  objective?: string;
  acceptanceCriteria?: ProjectTaskCriterion[];
  assumptions?: ProjectTaskAssumption[];
  killConditions?: ProjectTaskKillCondition[];
  retrospective?: ProjectTaskRetrospective | null;
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
  description?: string | null;
  priority?: ProjectTaskPriority;
  parentTaskId?: string | null;
  startAt?: string | null;
  dueAt?: string | null;
  reviewer?: WorkActor | null;
  details?: ProjectTaskDetails | null;
}

export interface ListProjectTaskFilters {
  status?: ProjectTaskStatus;
  assigneeUserId?: number;
  includeDone?: boolean;
  kind?: ProjectTaskKind;
}

export interface ListWorkspaceTaskFilters {
  ownerTeammateId?: string;
  ownerOrResponsibleUserId?: number;
  reviewerTeammateId?: string;
  includeDone?: boolean;
  kind?: ProjectTaskKind;
}

function readOwner(row: ProjectTaskRow, runner: ProjectTaskRunner | null): WorkActor | null {
  if (runner?.teammateId) {
    return { type: "teammate", id: runner.teammateId };
  }

  return row.assignee_user_id ? { type: "person", userId: row.assignee_user_id } : null;
}

function formatProjectTaskLink(row: ProjectTaskLinkRow): ProjectTaskLink {
  return {
    id: row.id,
    fromTaskId: row.from_task_id,
    toTaskId: row.to_task_id,
    kind: row.kind,
    createdAt: row.created_at,
  };
}

function formatProjectTask(row: ProjectTaskRow): ProjectTask {
  const runner = parseJsonColumn<ProjectTaskRunner | null>(row.runner, null);

  return {
    id: row.id,
    projectId: row.project_id,
    workspaceId: row.workspace_id,
    key: row.key,
    number: row.number,
    kind: row.kind,
    description: row.description,
    priority: row.priority,
    parentTaskId: row.parent_task_id,
    startAt: row.start_at,
    dueAt: row.due_at,
    owner: readOwner(row, runner),
    reviewer: parseJsonColumn<WorkActor | null>(row.reviewer, null),
    details: parseJsonColumn<ProjectTaskDetails>(row.details, {}),
    objective: row.objective,
    executionProfile: row.execution_profile,
    status: row.status,
    source: row.source,
    blockedReason: row.blocked_reason,
    blockedDetail: row.blocked_detail,
    stageId: row.stage_id,
    flowSnapshot: parseJsonColumn<ProjectFlow | null>(row.flow_snapshot, null),
    runner,
    acceptanceCriteria: parseJsonColumn<ProjectTaskCriterion[]>(row.acceptance_criteria, []),
    assumptions: parseJsonColumn<ProjectTaskAssumption[]>(row.assumptions, []),
    killConditions: parseJsonColumn<ProjectTaskKillCondition[]>(row.kill_conditions, []),
    retrospective: parseJsonColumn<ProjectTaskRetrospective | null>(row.retrospective, null),
    expectedOutput: row.expected_output,
    context: parseJsonColumn<ProjectTaskContext | null>(row.context, null),
    constraints: parseJsonColumn<ProjectTaskConstraints | null>(row.constraints, null),
    dependsOnTaskIds: parseJsonColumn<string[]>(row.depends_on_task_ids, []),
    requireApprovalFor: parseJsonColumn<ToolPermission[]>(row.require_approval_for, []),
    createdByUserId: row.created_by_user_id,
    assigneeUserId: row.assignee_user_id,
    runnerIdentityUserId: row.runner_identity_user_id,
    conversationId: row.conversation_id,
    originConversationId: row.origin_conversation_id,
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
  private buildTaskInsert(params: CreateProjectTaskParams) {
    const insert = this.buildInsertQuery(
      "project_task",
      {
        id: params.id ?? generateId(),
        project_id: params.projectId,
        workspace_id: params.workspaceId,
        objective: params.objective,
        execution_profile: params.executionProfile ?? null,
        acceptance_criteria: params.acceptanceCriteria ?? [],
        assumptions: params.assumptions ?? [],
        kill_conditions: params.killConditions ?? [],
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
        origin_conversation_id: params.originConversationId ?? null,
        position: params.position,
        number: params.number ?? null,
        key: params.key ?? null,
        kind: params.kind ?? "task",
        description: params.description ?? null,
        priority: params.priority ?? "none",
        parent_task_id: params.parentTaskId ?? null,
        start_at: params.startAt ?? null,
        due_at: params.dueAt ?? null,
        reviewer: params.reviewer ?? null,
        details: params.details ?? null,
      },
      {
        jsonFields: [
          "reviewer",
          "details",
          "acceptance_criteria",
          "assumptions",
          "kill_conditions",
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

    return insert;
  }

  prepareTaskCreation(params: CreateProjectTaskParams): D1PreparedStatement {
    const insert = this.buildTaskInsert(params);

    return this.env.DB.prepare(insert.query).bind(...insert.values);
  }

  async createTask(
    params: CreateProjectTaskParams,
  ): Promise<{ task: ProjectTask; created: boolean }> {
    const insert = this.buildTaskInsert(params);
    const row = await this.runQuery<ProjectTaskRow>(
      params.id
        ? insert.query.replace(" RETURNING ", " ON CONFLICT(id) DO NOTHING RETURNING ")
        : insert.query,
      insert.values,
      true,
    );

    if (!row) {
      const existing = params.id ? await this.getTaskById(params.id) : null;

      if (
        existing &&
        existing.projectId === params.projectId &&
        existing.createdByUserId === params.createdByUserId
      ) {
        return { task: existing, created: false };
      }

      throw new AssistantError("Failed to create the task", ErrorType.DATABASE_ERROR);
    }

    return { task: formatProjectTask(row), created: true };
  }

  async getTaskById(taskId: string): Promise<ProjectTask | null> {
    const row = await this.runQuery<ProjectTaskRow>(
      "SELECT * FROM project_task WHERE id = ?",
      [taskId],
      true,
    );

    return row ? formatProjectTask(row) : null;
  }

  async getTaskByReference(projectId: string, reference: string): Promise<ProjectTask | null> {
    const row = await this.runQuery<ProjectTaskRow>(
      "SELECT * FROM project_task WHERE project_id = ? AND (id = ? OR key = ?) LIMIT 1",
      [projectId, reference, reference.toUpperCase()],
      true,
    );

    return row ? formatProjectTask(row) : null;
  }

  async touchTask(taskId: string): Promise<void> {
    await this.executeRun("UPDATE project_task SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
      taskId,
    ]);
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

    if (filters.kind) {
      conditions.push("kind = ?");
      values.push(filters.kind);
    }

    const rows = await this.runQuery<ProjectTaskRow>(
      `SELECT * FROM project_task
       WHERE ${conditions.join(" AND ")}
       ORDER BY position ASC, created_at ASC`,
      values,
    );

    return rows.map(formatProjectTask);
  }

  async allocateTaskNumber(projectId: string): Promise<{ number: number; key: string }> {
    const row = await this.runQuery<{ task_sequence: number; task_prefix: string | null }>(
      `UPDATE project SET task_sequence = task_sequence + 1
       WHERE id = ?
       RETURNING task_sequence, task_prefix`,
      [projectId],
      true,
    );

    if (!row) {
      throw new AssistantError("Project not found", ErrorType.NOT_FOUND, 404);
    }

    return { number: row.task_sequence, key: `${row.task_prefix || "TSK"}-${row.task_sequence}` };
  }

  async listWorkspaceTasks(
    workspaceIds: readonly string[],
    filters: ListWorkspaceTaskFilters = {},
  ): Promise<ProjectTask[]> {
    if (workspaceIds.length === 0) {
      return [];
    }

    const conditions = [`workspace_id IN (${workspaceIds.map(() => "?").join(", ")})`];
    const values: unknown[] = [...workspaceIds];
    const ownership: string[] = [];

    if (!filters.includeDone) {
      conditions.push("status NOT IN ('done', 'cancelled')");
    }

    if (filters.kind) {
      conditions.push("kind = ?");
      values.push(filters.kind);
    }

    if (filters.ownerTeammateId) {
      ownership.push("json_extract(runner, '$.teammateId') = ?");
      values.push(filters.ownerTeammateId);
    }

    if (filters.reviewerTeammateId) {
      ownership.push(
        "(json_extract(reviewer, '$.type') = 'teammate' AND json_extract(reviewer, '$.id') = ? AND status = 'review')",
      );
      values.push(filters.reviewerTeammateId);
    }

    if (filters.ownerOrResponsibleUserId) {
      ownership.push(
        "(assignee_user_id = ? OR (runner_identity_user_id = ? AND json_extract(runner, '$.teammateId') IS NOT NULL))",
      );
      values.push(filters.ownerOrResponsibleUserId, filters.ownerOrResponsibleUserId);
    }

    if (ownership.length > 0) {
      conditions.push(`(${ownership.join(" OR ")})`);
    }

    const rows = await this.runQuery<ProjectTaskRow>(
      `SELECT * FROM project_task
       WHERE ${conditions.join(" AND ")}
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 500`,
      values,
    );

    return rows.map(formatProjectTask);
  }

  async listOpenProjectIds(
    workspaceId: string,
    ownerTeammateId: string | null,
    limit: number,
  ): Promise<string[]> {
    const rows = await this.runQuery<{ project_id: string }>(
      `SELECT DISTINCT project_id FROM project_task
       WHERE workspace_id = ?
         AND status NOT IN ('done', 'cancelled')
         AND (? IS NULL OR json_extract(runner, '$.teammateId') = ?)
       LIMIT ?`,
      [workspaceId, ownerTeammateId, ownerTeammateId, limit],
    );

    return rows.map((row) => row.project_id);
  }

  async hasTeammateTaskUpdatedSince(
    workspaceId: string,
    teammateId: string,
    since: string,
  ): Promise<boolean> {
    const row = await this.runQuery<{ found: number }>(
      `SELECT 1 AS found FROM project_task
       WHERE workspace_id = ?
         AND json_extract(runner, '$.teammateId') = ?
         AND datetime(updated_at) > datetime(?)
       LIMIT 1`,
      [workspaceId, teammateId, since],
      true,
    );

    return Boolean(row);
  }

  async searchTasksForUser(
    userId: number,
    query: string,
    limit: number,
  ): Promise<GlobalTaskSearchRow[]> {
    const trimmedQuery = query.trim();
    const searchTerm = `%${escapeSqlLikePattern(trimmedQuery)}%`;

    return this.runQuery<GlobalTaskSearchRow>(
      `SELECT t.id, t.key, t.objective, t.status, t.project_id, p.name AS project_name,
              t.workspace_id, t.updated_at
       FROM project_task t
       JOIN project p ON p.id = t.project_id AND p.archived_at IS NULL
       JOIN resource_grant wm ON wm.kind = 'membership' AND wm.workspace_id = t.workspace_id AND wm.user_id = ?
       WHERE ? <> ''
         AND (t.key = upper(?) OR t.objective LIKE ? ESCAPE '\\')
       ORDER BY CASE WHEN t.key = upper(?) THEN 0 ELSE 1 END,
                COALESCE(t.updated_at, t.created_at) DESC
       LIMIT ?`,
      [userId, trimmedQuery, trimmedQuery, searchTerm, trimmedQuery, limit],
    );
  }

  async listOpenTasksForInbox(workspaceIds: readonly string[]): Promise<ProjectTask[]> {
    if (workspaceIds.length === 0) {
      return [];
    }

    const rows = await this.runQuery<ProjectTaskRow>(
      `SELECT * FROM project_task
       WHERE workspace_id IN (${workspaceIds.map(() => "?").join(", ")})
         AND status NOT IN ('done', 'cancelled')
         AND (
           kind = 'standup'
           OR json_extract(details, '$.escalation') IS NOT NULL
           OR (
             json_extract(details, '$.breakdown') IS NOT NULL
             AND json_extract(details, '$.breakdown.acceptedAt') IS NULL
           )
         )
       ORDER BY updated_at DESC
       LIMIT 200`,
      [...workspaceIds],
    );

    return rows.map(formatProjectTask);
  }

  async findOpenChannelCase(
    bindingId: string,
    threadKey: string | null,
  ): Promise<ProjectTask | null> {
    if (!threadKey) {
      return null;
    }

    const row = await this.runQuery<ProjectTaskRow>(
      `SELECT * FROM project_task
       WHERE kind = 'case'
         AND status NOT IN ('done', 'cancelled')
         AND json_extract(details, '$.case.channel.bindingId') = ?
         AND json_extract(details, '$.case.channel.threadId') = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [bindingId, threadKey],
      true,
    );

    return row ? formatProjectTask(row) : null;
  }

  async listBlockedForRunner(
    runnerIdentityUserId: number,
    reason: ProjectTaskBlockedReason,
  ): Promise<ProjectTask[]> {
    const rows = await this.runQuery<ProjectTaskRow>(
      `SELECT * FROM project_task
       WHERE status = 'blocked' AND blocked_reason = ? AND runner_identity_user_id = ?
       ORDER BY position ASC
       LIMIT 50`,
      [reason, runnerIdentityUserId],
    );

    return rows.map(formatProjectTask);
  }

  async listTasksByIds(taskIds: readonly string[]): Promise<ProjectTask[]> {
    if (taskIds.length === 0) {
      return [];
    }

    const rows = await this.runQuery<ProjectTaskRow>(
      `SELECT * FROM project_task WHERE id IN (${taskIds.map(() => "?").join(", ")})`,
      [...taskIds],
    );

    return rows.map(formatProjectTask);
  }

  async listChildren(taskId: string): Promise<ProjectTask[]> {
    const rows = await this.runQuery<ProjectTaskRow>(
      `SELECT * FROM project_task WHERE parent_task_id = ? ORDER BY position ASC, created_at ASC`,
      [taskId],
    );

    return rows.map(formatProjectTask);
  }

  async createLink(params: {
    workspaceId: string;
    fromTaskId: string;
    toTaskId: string;
    kind: ProjectTaskLinkKind;
  }): Promise<ProjectTaskLink> {
    const row = await this.runQuery<ProjectTaskLinkRow>(
      `INSERT INTO project_task_link (id, workspace_id, from_task_id, to_task_id, kind)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(from_task_id, to_task_id, kind) DO UPDATE SET kind = excluded.kind
       RETURNING *`,
      [generateId(), params.workspaceId, params.fromTaskId, params.toTaskId, params.kind],
      true,
    );

    if (!row) {
      throw new AssistantError("Could not link those tasks", ErrorType.DATABASE_ERROR);
    }

    return formatProjectTaskLink(row);
  }

  async listLinks(taskId: string): Promise<ProjectTaskLink[]> {
    const rows = await this.runQuery<ProjectTaskLinkRow>(
      `SELECT * FROM project_task_link WHERE from_task_id = ? OR to_task_id = ? ORDER BY created_at ASC`,
      [taskId, taskId],
    );

    return rows.map(formatProjectTaskLink);
  }

  async deleteLink(linkId: string, taskId: string): Promise<boolean> {
    const row = await this.runQuery<{ id: string }>(
      `DELETE FROM project_task_link WHERE id = ? AND (from_task_id = ? OR to_task_id = ?) RETURNING id`,
      [linkId, taskId, taskId],
      true,
    );

    return Boolean(row);
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

    if (updates.assumptions !== undefined) {
      set("assumptions", JSON.stringify(updates.assumptions));
    }

    if (updates.killConditions !== undefined) {
      set("kill_conditions", JSON.stringify(updates.killConditions));
    }

    if (updates.retrospective !== undefined) {
      set("retrospective", updates.retrospective ? JSON.stringify(updates.retrospective) : null);
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

    if (updates.description !== undefined) {
      set("description", updates.description);
    }

    if (updates.priority !== undefined) {
      set("priority", updates.priority);
    }

    if (updates.parentTaskId !== undefined) {
      set("parent_task_id", updates.parentTaskId);
    }

    if (updates.startAt !== undefined) {
      set("start_at", updates.startAt);
    }

    if (updates.dueAt !== undefined) {
      set("due_at", updates.dueAt);
    }

    if (updates.reviewer !== undefined) {
      set("reviewer", updates.reviewer ? JSON.stringify(updates.reviewer) : null);
    }

    if (updates.details !== undefined) {
      set("details", updates.details ? JSON.stringify(updates.details) : null);
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

    if (!row) {
      return null;
    }

    const task = formatProjectTask(row);

    await publishProjectEvent({ env: this.env }, task.projectId, "project_task.changed", {
      taskId: task.id,
      status: task.status,
    });

    return task;
  }

  async queueTaskForRun(params: {
    taskId: string;
    projectId: string;
    runnerIdentityUserId: number;
    dispatchTaskId: string;
    runner: ProjectTaskRunner;
    tokenBudget: number;
    stageId?: string | null;
    expectedStatus: ProjectTaskStatus;
    expectedDispatchTaskId: string | null;
    automaticReviewPolicyRevision?: string;
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
         AND status = ?
         AND dispatch_task_id IS ?
         ${
           params.automaticReviewPolicyRevision
             ? `AND EXISTS (
           SELECT 1 FROM scoped_configuration p JOIN project_task_integration r ON r.kind = 'review' AND r.policy_id = p.id AND r.project_id = p.project_id AND r.workspace_id = p.workspace_id
           WHERE p.kind = 'review_policy' AND r.task_id = project_task.id AND p.enabled = 1 AND p.revision = ? AND r.policy_revision = p.revision
             AND p.owner_user_id = ? AND r.owner_user_id = p.owner_user_id AND r.workspace_id = project_task.workspace_id
             AND p.connection_id = json_extract(r.target, '$.connectionId')
             AND p.target_kind = json_extract(r.target, '$.provider')
             AND p.account_id = json_extract(r.target, '$.accountId')
             AND p.target_id = json_extract(r.target, '$.repository')
         )`
             : ""
         }
       RETURNING *`,
      [
        params.runnerIdentityUserId,
        params.dispatchTaskId,
        JSON.stringify(params.runner),
        params.tokenBudget,
        params.stageId ?? null,
        params.taskId,
        params.projectId,
        params.expectedStatus,
        params.expectedDispatchTaskId,
        ...(params.automaticReviewPolicyRevision
          ? [params.automaticReviewPolicyRevision, params.runnerIdentityUserId]
          : []),
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
