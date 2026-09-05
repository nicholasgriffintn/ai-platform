import type {
  WorkAttentionItem,
  WorkAttentionKind,
  WorkAttentionQuery,
  WorkAttentionType,
} from "@ngriffin_uk/polychat-schemas";
import { SANDBOX_RUNS_CAPABILITY_ID } from "@ngriffin_uk/polychat-schemas";

import { isConversationUnread } from "~/utils/conversation-organisation";

import { BaseRepository } from "./BaseRepository";

interface AttentionRow {
  id: string;
  kind: WorkAttentionKind;
  item_type: WorkAttentionType;
  resource_id: string;
  workspace_id: string;
  workspace_name: string;
  project_id: string;
  project_name: string;
  conversation_id: string | null;
  owner_user_id: number;
  owner_name: string;
  is_unread: number;
  next_response_arrived: number;
  title: string;
  detail: string | null;
  occurred_at: string;
}

interface CountRow {
  total: number;
}

const CANDIDATES_QUERY = `
  WITH candidates AS (
    SELECT
      'task:' || pt.id AS id,
      CASE
        WHEN pt.status = 'blocked' AND pt.blocked_reason = 'awaiting_approval' THEN 'approval'
        WHEN pt.status = 'blocked' AND pt.blocked_reason = 'awaiting_input' THEN 'input'
        WHEN pt.status = 'blocked' THEN 'failed'
        WHEN pt.status = 'review' THEN 'review'
        WHEN pt.status IN ('queued', 'running') THEN 'running'
        ELSE 'completed'
      END AS kind,
      'task' AS item_type,
      pt.id AS resource_id,
      pt.workspace_id,
      w.name AS workspace_name,
      pt.project_id,
      p.name AS project_name,
      pt.conversation_id,
      COALESCE(pt.runner_identity_user_id, pt.assignee_user_id, pt.created_by_user_id) AS owner_user_id,
      COALESCE(owner.name, owner.email) AS owner_name,
      COALESCE(org.is_unread, 0) AS is_unread,
      EXISTS (
        SELECT 1 FROM message response
        WHERE response.conversation_id = pt.conversation_id
          AND response.role = 'assistant'
          AND org.snoozed_next_response_at IS NOT NULL
          AND julianday(response.created_at) > julianday(org.snoozed_next_response_at)
      ) AS next_response_arrived,
      pt.objective AS title,
      pt.blocked_detail AS detail,
      COALESCE(pt.updated_at, pt.created_at) AS occurred_at
    FROM project_task pt
    JOIN project p ON p.id = pt.project_id AND p.archived_at IS NULL
    JOIN workspace w ON w.id = pt.workspace_id
    JOIN workspace_member viewer ON viewer.workspace_id = pt.workspace_id AND viewer.user_id = ?
    LEFT JOIN conversation_user_state org
      ON org.conversation_id = pt.conversation_id AND org.user_id = ?
    JOIN user owner ON owner.id = COALESCE(pt.runner_identity_user_id, pt.assignee_user_id, pt.created_by_user_id)
    WHERE (
      pt.status IN ('blocked', 'review', 'queued', 'running')
      OR (pt.status = 'done' AND datetime(pt.completed_at) >= datetime('now', '-7 days'))
    )
    AND NOT (
      COALESCE(datetime(org.snoozed_until) > datetime('now'), 0)
      OR (
        org.snoozed_next_response_at IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM message response
          WHERE response.conversation_id = pt.conversation_id
            AND response.role = 'assistant'
            AND julianday(response.created_at) > julianday(org.snoozed_next_response_at)
        )
      )
    )

    UNION ALL

    SELECT
      'run:' || ar.id AS id,
      CASE
        WHEN ar.status = 'waiting'
          AND COALESCE(json_extract(ar.data, '$.status'), '') != 'paused'
          AND datetime(COALESCE(ar.updated_at, ar.created_at)) >= datetime('now', '-30 minutes')
          THEN 'approval'
        WHEN ar.status = 'waiting' AND COALESCE(json_extract(ar.data, '$.status'), '') != 'paused' THEN 'failed'
        WHEN ar.status IN ('queued', 'running', 'waiting') THEN 'running'
        WHEN ar.status = 'failed' THEN 'failed'
        ELSE 'completed'
      END AS kind,
      'run' AS item_type,
      ar.group_id AS resource_id,
      p.workspace_id,
      w.name AS workspace_name,
      ar.project_id,
      p.name AS project_name,
      ar.conversation_id,
      ar.created_by_user_id AS owner_user_id,
      COALESCE(owner.name, owner.email) AS owner_name,
      COALESCE(org.is_unread, 0) AS is_unread,
      EXISTS (
        SELECT 1 FROM message response
        WHERE response.conversation_id = ar.conversation_id
          AND response.role = 'assistant'
          AND org.snoozed_next_response_at IS NOT NULL
          AND julianday(response.created_at) > julianday(org.snoozed_next_response_at)
      ) AS next_response_arrived,
      ar.summary AS title,
      CASE WHEN ar.status = 'failed' THEN json_extract(ar.data, '$.error') ELSE NULL END AS detail,
      COALESCE(ar.updated_at, ar.created_at) AS occurred_at
    FROM activity_record ar
    JOIN project p ON p.id = ar.project_id AND p.archived_at IS NULL
    JOIN workspace w ON w.id = p.workspace_id
    JOIN workspace_member viewer ON viewer.workspace_id = p.workspace_id AND viewer.user_id = ?
    LEFT JOIN conversation_user_state org
      ON org.conversation_id = ar.conversation_id AND org.user_id = ?
    JOIN user owner ON owner.id = ar.created_by_user_id
    WHERE ar.capability_id = ?
      AND ar.group_id IS NOT NULL
      AND (
        ar.status IN ('queued', 'running', 'waiting', 'failed')
        OR (ar.status = 'succeeded' AND datetime(COALESCE(ar.updated_at, ar.created_at)) >= datetime('now', '-7 days'))
      )
      AND NOT (
        COALESCE(datetime(org.snoozed_until) > datetime('now'), 0)
        OR (
          org.snoozed_next_response_at IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM message response
            WHERE response.conversation_id = ar.conversation_id
              AND response.role = 'assistant'
              AND julianday(response.created_at) > julianday(org.snoozed_next_response_at)
          )
        )
      )
  )`;

function filtersQuery(query: WorkAttentionQuery): { sql: string; values: unknown[] } {
  const clauses: string[] = [];
  const values: unknown[] = [];

  const add = (clause: string, value: unknown) => {
    clauses.push(clause);
    values.push(value);
  };

  if (query.kind) {
    add("kind = ?", query.kind);
  }

  if (query.workspaceId) {
    add("workspace_id = ?", query.workspaceId);
  }

  if (query.projectId) {
    add("project_id = ?", query.projectId);
  }

  if (query.ownerUserId) {
    add("owner_user_id = ?", query.ownerUserId);
  }

  if (query.type) {
    add("item_type = ?", query.type);
  }

  if (query.from) {
    add("date(occurred_at) >= date(?)", query.from);
  }

  if (query.to) {
    add("date(occurred_at) <= date(?)", query.to);
  }

  return {
    sql: clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}

function formatItem(row: AttentionRow): WorkAttentionItem {
  return {
    id: row.id,
    kind: row.kind,
    type: row.item_type,
    resourceId: row.resource_id,
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    projectId: row.project_id,
    projectName: row.project_name,
    conversationId: row.conversation_id,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name,
    isUnread: isConversationUnread(row),
    title: row.title,
    detail: row.detail,
    occurredAt: row.occurred_at,
  };
}

export class AttentionRepository extends BaseRepository {
  async list(userId: number, query: WorkAttentionQuery) {
    const filters = filtersQuery(query);
    const baseValues = [userId, userId, userId, userId, SANDBOX_RUNS_CAPABILITY_ID];
    const [rows, count] = await Promise.all([
      this.runQuery<AttentionRow>(
        `${CANDIDATES_QUERY}
         SELECT * FROM candidates${filters.sql}
         ORDER BY occurred_at DESC, id DESC
         LIMIT ? OFFSET ?`,
        [...baseValues, ...filters.values, query.limit, query.offset],
      ),
      this.runQuery<CountRow>(
        `${CANDIDATES_QUERY}
         SELECT COUNT(*) AS total FROM candidates${filters.sql}`,
        [...baseValues, ...filters.values],
        true,
      ),
    ]);

    return { items: rows.map(formatItem), total: count?.total ?? 0 };
  }

  async listFacets(userId: number) {
    const baseValues = [userId, userId, userId, userId, SANDBOX_RUNS_CAPABILITY_ID];
    const [workspaces, projects, owners] = await Promise.all([
      this.runQuery<{ id: string; name: string }>(
        `${CANDIDATES_QUERY}
         SELECT DISTINCT workspace_id AS id, workspace_name AS name
         FROM candidates
         ORDER BY name ASC, id ASC`,
        baseValues,
      ),
      this.runQuery<{ id: string; workspace_id: string; name: string }>(
        `${CANDIDATES_QUERY}
         SELECT DISTINCT project_id AS id, workspace_id, project_name AS name
         FROM candidates
         ORDER BY name ASC, id ASC`,
        baseValues,
      ),
      this.runQuery<{ id: number; name: string }>(
        `${CANDIDATES_QUERY}
         SELECT DISTINCT owner_user_id AS id, owner_name AS name
         FROM candidates
         ORDER BY name ASC, id ASC`,
        baseValues,
      ),
    ]);

    return {
      workspaces,
      projects: projects.map((project) => ({
        id: project.id,
        workspaceId: project.workspace_id,
        name: project.name,
      })),
      owners,
    };
  }
}
