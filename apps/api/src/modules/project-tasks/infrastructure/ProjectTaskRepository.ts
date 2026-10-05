import {
  projectTaskSchema,
  createAdhocProjectFlow,
  PROJECT_TASK_DEFAULT_CONCURRENCY,
} from "@ngriffin_uk/polychat-schemas";
import type {
  ProjectTask,
  ProjectTaskBlockedReason,
  ProjectTaskCompletion,
  ProjectTaskConstraints,
  ProjectTaskContext,
  ProjectTaskCriterion,
  ProjectFlow,
  ProjectFlowExecution,
  ProjectTaskRunner,
  ProjectTaskSource,
  ProjectTaskStatus,
  ToolPermission,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonColumn } from "@ngriffin_uk/polychat-utility-server/json";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { ProjectTaskRow } from "~/infrastructure/database/schema";
import { publishProjectEvent } from "~/modules/sync/application/conversation-events";

import { initialProjectFlowExecution } from "../domain/flow-machine";

export interface CreateProjectTaskParams {
  id?: string;
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
  nodeId?: string | null;
  flowSnapshot?: ProjectFlow | null;
  flowExecution?: ProjectFlowExecution;
  tokenBudget?: number | null;
  originConversationId?: string | null;
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
  nodeId?: string | null;
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
  flowExecution?: ProjectFlowExecution;
}

export interface ListProjectTaskFilters {
  status?: ProjectTaskStatus;
  assigneeUserId?: number;
  includeDone?: boolean;
}

export function formatProjectTask(row: ProjectTaskRow): ProjectTask {
  return {
    id: row.id,
    projectId: row.project_id,
    workspaceId: row.workspace_id,
    objective: row.objective,
    status: row.status,
    source: row.source,
    blockedReason: row.blocked_reason,
    blockedDetail: row.blocked_detail,
    nodeId: row.node_id,
    flowSnapshot: parseJsonColumn(row.flow_snapshot, projectTaskSchema.shape.flowSnapshot),
    flowExecution: parseJsonColumn(row.flow_execution, projectTaskSchema.shape.flowExecution),
    flowRevision: row.flow_revision,
    runner: parseJsonColumn(row.runner ?? null, projectTaskSchema.shape.runner),
    acceptanceCriteria: parseJsonColumn(
      row.acceptance_criteria ?? undefined,
      projectTaskSchema.shape.acceptanceCriteria,
    ),
    expectedOutput: row.expected_output,
    context: parseJsonColumn(row.context ?? null, projectTaskSchema.shape.context),
    constraints: parseJsonColumn(row.constraints ?? null, projectTaskSchema.shape.constraints),
    dependsOnTaskIds: parseJsonColumn(
      row.depends_on_task_ids ?? undefined,
      projectTaskSchema.shape.dependsOnTaskIds,
    ),
    requireApprovalFor: parseJsonColumn(
      row.require_approval_for ?? undefined,
      projectTaskSchema.shape.requireApprovalFor,
    ),
    createdByUserId: row.created_by_user_id,
    assigneeUserId: row.assignee_user_id,
    runnerIdentityUserId: row.runner_identity_user_id,
    conversationId: row.conversation_id,
    originConversationId: row.origin_conversation_id,
    goalId: row.goal_id,
    dispatchTaskId: row.dispatch_task_id,
    runId: row.run_id,
    completions: parseJsonColumn(row.completions ?? undefined, projectTaskSchema.shape.completions),
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
    const flow = params.flowSnapshot ?? createAdhocProjectFlow();
    const nodeId = params.nodeId ?? flow.entryNodeId;
    const insert = this.buildInsertQuery(
      "project_task",
      {
        id: params.id ?? generateId(),
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
        node_id: nodeId,
        flow_snapshot: flow,
        flow_execution: params.flowExecution ?? initialProjectFlowExecution(flow, nodeId),
        flow_revision: 0,
        token_budget: params.tokenBudget ?? null,
        origin_conversation_id: params.originConversationId ?? null,
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
          "flow_execution",
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

  prepareTriggeredTask(params: {
    id: string;
    projectId: string;
    workspaceId: string;
    objective: string;
    createdByUserId: number;
    flowSnapshot: ProjectFlow;
    flowExecution: ProjectFlowExecution;
  }): D1PreparedStatement {
    return this.env.DB.prepare(`INSERT INTO project_task
      (id, project_id, workspace_id, objective, status, source, created_by_user_id,
       node_id, flow_snapshot, flow_execution, flow_revision, runner_identity_user_id, position)
      SELECT ?, ?, ?, ?, 'backlog', 'record_trigger', ?, ?, ?, ?, 0, ?,
        (SELECT COALESCE(MAX(position), 0) + 1000 FROM project_task WHERE project_id = ?)
      WHERE changes() = 1`).bind(
      params.id,
      params.projectId,
      params.workspaceId,
      params.objective,
      params.createdByUserId,
      params.flowExecution.nodeId,
      JSON.stringify(params.flowSnapshot),
      JSON.stringify(params.flowExecution),
      params.createdByUserId,
      params.projectId,
    );
  }

  async createTask(params: CreateProjectTaskParams): Promise<ProjectTask> {
    const insert = this.buildTaskInsert(params);

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
    expectedPlanRevision?: number,
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

    if (updates.nodeId !== undefined) {
      set("node_id", updates.nodeId);
    }

    if (updates.flowExecution !== undefined) {
      set("flow_execution", JSON.stringify(updates.flowExecution));
      columns.push("flow_revision = flow_revision + 1");
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

    if (expectedPlanRevision !== undefined) {
      ownershipClause +=
        " AND flow_revision = ? AND status = 'backlog' AND runner_identity_user_id IS NULL AND json_extract(flow_execution, '$.steps') = 0";
      values.push(expectedPlanRevision);
    }

    if (executionOwner) {
      ownershipClause += `
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
    nodeId?: string | null;
    flowRevision: number;
    waitId: string;
    waitRevision: number;
    newNode: boolean;
  }): Promise<ProjectTask | null> {
    const statements = [
      this.env.DB.prepare(
        `UPDATE project_task
       SET status = 'queued',
           runner_identity_user_id = ?,
           dispatch_task_id = ?,
           runner = ?,
           token_budget = ?,
           node_id = COALESCE(?, node_id),
           goal_id = NULL,
           run_id = CASE WHEN ? = 1 THEN NULL ELSE run_id END,
           conversation_id = CASE WHEN ? = 1 THEN NULL ELSE conversation_id END,
           blocked_reason = NULL,
           blocked_detail = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND project_id = ?
         AND status IN ('backlog', 'queued', 'blocked', 'review', 'running')
         AND (SELECT COUNT(*) FROM project_task AS active WHERE active.project_id = project_task.project_id
           AND active.id != project_task.id AND active.status IN ('queued', 'running')) < ?
         AND flow_revision = ? AND json_extract(flow_execution, '$.waitId') = ?
         AND (runner_identity_user_id IS NULL OR runner_identity_user_id = ?)
         AND EXISTS (SELECT 1 FROM workspace_member WHERE workspace_id = project_task.workspace_id AND user_id = ? AND role IN ('owner', 'admin', 'member'))
         AND EXISTS (SELECT 1 FROM project_flow_wait WHERE id = ? AND task_id = project_task.id
           AND kind IN ('agent', 'function') AND revision = ? AND status IN ('pending', 'dispatched'))`,
      ).bind(
        params.runnerIdentityUserId,
        params.dispatchTaskId,
        JSON.stringify(params.runner),
        params.tokenBudget,
        params.nodeId ?? null,
        params.newNode ? 1 : 0,
        params.newNode ? 1 : 0,
        params.taskId,
        params.projectId,
        PROJECT_TASK_DEFAULT_CONCURRENCY,
        params.flowRevision,
        params.waitId,
        params.runnerIdentityUserId,
        params.runnerIdentityUserId,
        params.waitId,
        params.waitRevision,
      ),
      this.env.DB.prepare(`UPDATE project_flow_wait SET status = 'dispatched', execution_id = ?,
        attempt = CASE WHEN status = 'dispatched' THEN attempt + 1 ELSE attempt END,
        error = NULL, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND changes() = 1`).bind(
        params.dispatchTaskId,
        params.waitId,
      ),
      this.env.DB.prepare(`INSERT INTO project_flow_event
        (task_id, node_id, epoch, step, kind, wait_id, actor_user_id)
        SELECT task_id, node_id, epoch, step, 'dispatched', id, ? FROM project_flow_wait
        WHERE id = ? AND changes() = 1`).bind(params.runnerIdentityUserId, params.waitId),
    ];
    const result = await this.env.DB.batch(statements);

    return result[0]?.meta.changes === 1 ? this.getTaskById(params.taskId) : null;
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
