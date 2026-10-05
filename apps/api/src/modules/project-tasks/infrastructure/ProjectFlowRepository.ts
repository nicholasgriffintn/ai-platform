import {
  projectFlowWaitSchema,
  projectFlowEventSchema,
  type ProjectFlowExecution,
  type ProjectFlowWait,
  type ProjectFlowEvent,
  type ProjectTask,
  type ProjectTaskStatus,
  type ProjectTaskBlockedReason,
  type ProjectTaskCompletion,
  type NativeRecordValues,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonColumn } from "@ngriffin_uk/polychat-utility-server/json";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type {
  ProjectFlowWaitRow,
  ProjectFlowEventRow,
  ProjectTaskRow,
} from "~/infrastructure/database/schema";

import { formatProjectTask } from "./ProjectTaskRepository";

export interface FlowExecutionOwner {
  dispatchTaskId: string;
  ownerToken: string;
}

function formatWait(row: ProjectFlowWaitRow): ProjectFlowWait {
  return projectFlowWaitSchema.parse({
    id: row.id,
    taskId: row.task_id,
    nodeId: row.node_id,
    epoch: row.epoch,
    step: row.step,
    attempt: row.attempt,
    name: row.name,
    kind: row.kind,
    status: row.status,
    revision: row.revision,
    assignedUserId: row.assigned_user_id,
    dueAt: row.due_at,
    executionId: row.execution_id,
    payload: parseJsonColumn(row.payload, projectFlowWaitSchema.shape.payload),
    response: parseJsonColumn(row.response, projectFlowWaitSchema.shape.response),
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  });
}

function formatEvent(row: ProjectFlowEventRow): ProjectFlowEvent {
  return projectFlowEventSchema.parse({
    sequence: row.sequence,
    taskId: row.task_id,
    nodeId: row.node_id,
    epoch: row.epoch,
    step: row.step,
    kind: row.kind,
    waitId: row.wait_id,
    detail: row.detail,
    actorUserId: row.actor_user_id,
    createdAt: row.created_at,
  });
}

export class ProjectFlowRepository extends BaseRepository {
  async getWait(id: string): Promise<ProjectFlowWait | null> {
    const row = await this.runQuery<ProjectFlowWaitRow>(
      "SELECT * FROM project_flow_wait WHERE id = ?",
      [id],
      true,
    );

    return row ? formatWait(row) : null;
  }

  async responseMatches(id: string, digest: string): Promise<boolean> {
    const row = await this.runQuery<{ id: string }>(
      "SELECT id FROM project_flow_wait WHERE id = ? AND status = 'completed' AND response_digest = ?",
      [id, digest],
      true,
    );

    return Boolean(row);
  }

  async recordDispatchFailure(
    taskId: string,
    dispatchTaskId: string,
    actorUserId: number,
    detail: string,
    owner?: FlowExecutionOwner,
  ): Promise<void> {
    await this.env.DB.batch([
      this.env.DB.prepare(`UPDATE project_flow_wait SET error = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
        WHERE task_id = ? AND execution_id = ? AND status = 'dispatched' AND EXISTS
          (SELECT 1 FROM project_task WHERE id = ? AND dispatch_task_id = ? AND status = 'blocked'
            AND json_extract(flow_execution, '$.waitId') = project_flow_wait.id
            AND EXISTS (SELECT 1 FROM workspace_member WHERE workspace_id = project_task.workspace_id
              AND user_id = ? AND role IN ('owner', 'admin', 'member'))
            ${owner ? "AND EXISTS (SELECT 1 FROM tasks WHERE id = project_task.dispatch_task_id AND status = 'running' AND execution_owner_token = ? AND datetime(execution_lease_expires_at) > datetime(?))" : ""})`).bind(
        detail.slice(0, 2000),
        taskId,
        dispatchTaskId,
        taskId,
        dispatchTaskId,
        actorUserId,
        ...(owner ? [owner.ownerToken, new Date().toISOString()] : []),
      ),
      this.env.DB.prepare(`INSERT INTO project_flow_event (task_id, node_id, epoch, step, kind, wait_id, detail, actor_user_id)
        SELECT task_id, node_id, epoch, step, 'failed', id, ?, ? FROM project_flow_wait
        WHERE task_id = ? AND execution_id = ? AND changes() = 1`).bind(
        detail.slice(0, 2000),
        actorUserId,
        taskId,
        dispatchTaskId,
      ),
    ]);
  }

  async history(taskId: string, after: number, access: { projectId: string; actorUserId: number }) {
    const results = await this.executeBatch<ProjectFlowEventRow | { authorised: number }>([
      this.env.DB.prepare(`SELECT 1 AS authorised FROM project_task JOIN project ON project.id = project_task.project_id
        JOIN workspace_member ON workspace_member.workspace_id = project.workspace_id
        WHERE project_task.id = ? AND project.id = ? AND workspace_member.user_id = ?
          AND workspace_member.role IN ('owner', 'admin', 'member')`).bind(
        taskId,
        access.projectId,
        access.actorUserId,
      ),
      this.env.DB.prepare(
        "SELECT * FROM project_flow_event WHERE task_id = ? AND sequence > ? ORDER BY sequence LIMIT 101",
      ).bind(taskId, after),
    ]);

    if (!results[0]?.results[0]) {
      throw new AssistantError("Task permissions changed", ErrorType.FORBIDDEN, 403);
    }

    const rows = results[1]?.results ?? [];
    const events = rows.slice(0, 100).map((row) => {
      if (!("sequence" in row)) {
        throw new AssistantError("Invalid flow event", ErrorType.DATABASE_ERROR);
      }

      return formatEvent(row);
    });

    return { events, nextCursor: events.at(-1)?.sequence ?? after, hasMore: rows.length > 100 };
  }

  async dueTimers(now: string): Promise<ProjectFlowWait[]> {
    const rows = await this.runQuery<ProjectFlowWaitRow>(
      `SELECT project_flow_wait.* FROM project_flow_wait JOIN project_task
       ON project_task.id = project_flow_wait.task_id
       WHERE project_flow_wait.kind = 'timer' AND project_flow_wait.status = 'pending'
         AND datetime(due_at) <= datetime(?) AND project_task.status = 'blocked'
         AND json_extract(project_task.flow_execution, '$.waitId') = project_flow_wait.id
         AND EXISTS (SELECT 1 FROM workspace_member WHERE workspace_id = project_task.workspace_id
           AND user_id = project_task.runner_identity_user_id)
       ORDER BY due_at LIMIT 100`,
      [now],
    );

    return rows.map(formatWait);
  }

  async resumableTasks(): Promise<ProjectTask[]> {
    const rows = await this.runQuery<ProjectTaskRow>(`SELECT * FROM project_task
      WHERE ((status = 'backlog' AND runner_identity_user_id IS NOT NULL)
        OR (status = 'queued' AND dispatch_task_id IS NOT NULL AND NOT EXISTS
          (SELECT 1 FROM tasks WHERE tasks.id = project_task.dispatch_task_id)
          AND datetime(project_task.updated_at) < datetime('now', '-1 minute')))
        AND EXISTS (SELECT 1 FROM workspace_member WHERE workspace_id = project_task.workspace_id AND user_id = runner_identity_user_id)
      ORDER BY updated_at LIMIT 100`);

    return rows.map(formatProjectTask);
  }

  async transition(params: {
    task: ProjectTask;
    execution: ProjectFlowExecution;
    actorUserId: number;
    status: ProjectTaskStatus;
    blockedReason?: ProjectTaskBlockedReason;
    kind: ProjectFlowEvent["kind"];
    detail?: string;
    wait?: ProjectFlowWait;
    resolve?: { wait: ProjectFlowWait; values: NativeRecordValues; digest: string };
    completions?: ProjectTaskCompletion[];
    tokensSpent?: number;
    owner?: FlowExecutionOwner;
  }): Promise<boolean> {
    const { task, execution, resolve, wait, owner } = params;
    const now = new Date().toISOString();
    const conditions = [
      "id = ?",
      "project_id = ?",
      "workspace_id = ?",
      "flow_revision = ?",
      "status = ?",
      "status NOT IN ('done', 'cancelled')",
      `EXISTS (SELECT 1 FROM workspace_member JOIN project ON project.workspace_id = workspace_member.workspace_id
        WHERE project.id = project_task.project_id AND workspace_member.user_id = ? AND workspace_member.role IN ('owner', 'admin', 'member'))`,
      `(runner_identity_user_id IS NULL OR EXISTS (SELECT 1 FROM workspace_member
        WHERE workspace_member.workspace_id = project_task.workspace_id AND workspace_member.user_id = runner_identity_user_id AND workspace_member.role IN ('owner', 'admin', 'member')))`,
    ];
    const guard: unknown[] = [
      task.id,
      task.projectId,
      task.workspaceId,
      task.flowRevision,
      task.status,
      params.actorUserId,
    ];

    if (owner) {
      conditions.push(`dispatch_task_id = ? AND EXISTS (SELECT 1 FROM tasks WHERE tasks.id = ?
        AND tasks.status = 'running' AND tasks.execution_owner_token = ?
        AND datetime(tasks.execution_lease_expires_at) > datetime(?))`);
      guard.push(owner.dispatchTaskId, owner.dispatchTaskId, owner.ownerToken, now);
    }

    if (resolve) {
      conditions.push(`json_extract(flow_execution, '$.waitId') = ? AND EXISTS
        (SELECT 1 FROM project_flow_wait WHERE id = ? AND task_id = project_task.id
          AND revision = ? AND status IN ('pending', 'dispatched')
          AND (? != 'human' OR COALESCE(json_extract(payload, '$.assignedUserId'), assigned_user_id) IS NULL
            OR COALESCE(json_extract(payload, '$.assignedUserId'), assigned_user_id) = ?
            OR EXISTS (SELECT 1 FROM workspace_member WHERE workspace_id = project_task.workspace_id
              AND user_id = ? AND role IN ('owner', 'admin')))
          AND (? != 'timer' OR datetime(due_at) <= datetime(?)))`);
      guard.push(
        resolve.wait.id,
        resolve.wait.id,
        resolve.wait.revision,
        resolve.wait.kind,
        params.actorUserId,
        params.actorUserId,
        resolve.wait.kind,
        now,
      );
    }

    const blockedReason =
      params.blockedReason ?? (wait?.kind === "timer" ? "awaiting_timer" : null);
    const statements = [
      this.env.DB.prepare(`UPDATE project_task SET
      flow_execution = ?, flow_revision = flow_revision + 1, node_id = ?, status = ?,
      runner_identity_user_id = COALESCE(runner_identity_user_id, ?),
      blocked_reason = ?, blocked_detail = ?, completed_at = ?,
      completions = COALESCE(?, completions), tokens_spent = COALESCE(?, tokens_spent),
      dispatch_task_id = CASE WHEN ? = 1 THEN NULL ELSE dispatch_task_id END,
      goal_id = CASE WHEN ? = 1 THEN NULL ELSE goal_id END,
      attention_version = attention_version + 1, updated_at = ?
      WHERE ${conditions.join(" AND ")}`).bind(
        JSON.stringify(execution),
        execution.nodeId,
        params.status,
        params.actorUserId,
        blockedReason,
        params.detail?.slice(0, 500) ?? null,
        params.status === "done" || params.status === "cancelled" ? now : null,
        params.completions ? JSON.stringify(params.completions) : null,
        params.tokensSpent ?? null,
        resolve ? 1 : 0,
        resolve ? 1 : 0,
        now,
        ...guard,
      ),
    ];

    if (wait) {
      statements.push(
        this.env.DB.prepare(`INSERT INTO project_flow_wait
        (id, task_id, node_id, epoch, step, attempt, name, kind, status, revision,
         assigned_user_id, due_at, execution_id, payload, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1`).bind(
          wait.id,
          task.id,
          wait.nodeId,
          wait.epoch,
          wait.step,
          wait.attempt,
          wait.name,
          wait.kind,
          wait.status,
          wait.revision,
          wait.assignedUserId,
          wait.dueAt,
          wait.executionId,
          JSON.stringify(wait.payload),
          now,
          now,
        ),
      );
    }

    if (resolve) {
      statements.push(
        this.env.DB.prepare(`UPDATE project_flow_wait SET status = 'completed',
        revision = revision + 1, response = ?, response_digest = ?, resolved_at = ?, updated_at = ?
        WHERE id = ? AND changes() = 1`).bind(
          JSON.stringify(resolve.values),
          resolve.digest,
          now,
          now,
          resolve.wait.id,
        ),
      );
    }

    statements.push(
      this.env.DB.prepare(`INSERT INTO project_flow_event
      (task_id, node_id, epoch, step, kind, wait_id, detail, actor_user_id, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1`).bind(
        task.id,
        task.flowExecution.nodeId,
        execution.epoch,
        execution.steps,
        params.kind,
        wait?.id ?? resolve?.wait.id ?? null,
        params.detail?.slice(0, 2000) ?? null,
        params.actorUserId,
        now,
      ),
    );
    if (params.status === "cancelled") {
      statements.push(
        this.env.DB.prepare(`UPDATE project_flow_wait SET status = 'cancelled',
        revision = revision + 1, resolved_at = ?, updated_at = ? WHERE task_id = ?
        AND status IN ('pending', 'dispatched') AND changes() = 1`).bind(now, now, task.id),
      );
    }

    const result = await this.env.DB.batch(statements);

    return result[0]?.meta.changes === 1;
  }
}
