import {
  teammateConnectionGrantSchema,
  type TeammateConnectionGrant,
  type TeammateContext,
  type TeammateContextScope,
} from "@ngriffin_uk/polychat-schemas";

import type { TeammateConnectionGrantRow, TeammateContextRow } from "~/lib/database/schema";
import type { IEnv } from "~/types";
import { generateId } from "~/utils/id";
import { safeParseJson } from "~/utils/json";

import { BaseRepository } from "./BaseRepository";

function formatContext(row: TeammateContextRow): TeammateContext {
  return {
    id: row.id,
    teammateId: row.teammate_id,
    actorUserId: row.actor_user_id,
    scope: { type: row.scope_type, id: row.scope_id },
    homeConversationId: row.home_conversation_id,
    memoryDocumentId: row.memory_document_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatGrant(row: TeammateConnectionGrantRow): TeammateConnectionGrant {
  const allowedOperations = teammateConnectionGrantSchema.shape.allowedOperations
    .catch([])
    .parse(
      typeof row.allowed_operations === "string"
        ? safeParseJson<unknown>(row.allowed_operations)
        : row.allowed_operations,
    );

  return {
    id: row.id,
    contextId: row.context_id,
    connectionId: row.connection_id,
    allowedOperations,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TeammateContextRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async createWithResources(params: {
    id: string;
    teammateId: string;
    actorUserId: number;
    scope: TeammateContextScope;
    homeConversationId: string;
    memoryDocumentId: string;
    memoryDocumentName: string;
  }): Promise<TeammateContext> {
    const revisionId = generateId();
    const statements = [
      this.env.DB.prepare(
        `INSERT INTO memory_document (
           id, scope_type, scope_id, kind, name, content, revision, created_by
         ) VALUES (?, 'personal', ?, 'teammate_context', ?, '', 1, ?)`,
      ).bind(
        params.memoryDocumentId,
        String(params.actorUserId),
        params.memoryDocumentName,
        params.actorUserId,
      ),
      this.env.DB.prepare(
        `INSERT INTO memory_document_revision (
           id, document_id, revision, content, change_note, created_by
         ) VALUES (?, ?, 1, '', 'Created', ?)`,
      ).bind(revisionId, params.memoryDocumentId, params.actorUserId),
      this.env.DB.prepare(
        `INSERT INTO conversation (
           id, user_id, type, title, project_id, permission_mode, created_at, updated_at
         ) VALUES (?, ?, 'chat', (SELECT name FROM teammates WHERE id = ?), ?,
           'auto_accept_edits', datetime('now'), datetime('now'))`,
      ).bind(
        params.homeConversationId,
        params.actorUserId,
        params.teammateId,
        params.scope.type === "project" ? params.scope.id : null,
      ),
      this.env.DB.prepare(
        `INSERT INTO teammate_context (
           id, teammate_id, actor_user_id, scope_type, scope_id, home_conversation_id,
           memory_document_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        params.id,
        params.teammateId,
        params.actorUserId,
        params.scope.type,
        params.scope.id,
        params.homeConversationId,
        params.memoryDocumentId,
      ),
    ];

    await this.executeBatch(statements);
    const created = await this.getById(params.id);

    if (!created) {
      throw new Error("Teammate context was not created");
    }

    return created;
  }

  async getById(id: string): Promise<TeammateContext | null> {
    const row = await this.runQuery<TeammateContextRow>(
      "SELECT * FROM teammate_context WHERE id = ?",
      [id],
      true,
    );

    return row ? formatContext(row) : null;
  }

  async getByIdentity(params: {
    teammateId: string;
    actorUserId: number;
    scope: TeammateContextScope;
  }): Promise<TeammateContext | null> {
    const row = await this.runQuery<TeammateContextRow>(
      `SELECT * FROM teammate_context
       WHERE teammate_id = ? AND actor_user_id = ? AND scope_type = ? AND scope_id = ?`,
      [params.teammateId, params.actorUserId, params.scope.type, params.scope.id],
      true,
    );

    return row ? formatContext(row) : null;
  }

  async getByHomeConversationId(homeConversationId: string): Promise<TeammateContext | null> {
    const row = await this.runQuery<TeammateContextRow>(
      "SELECT * FROM teammate_context WHERE home_conversation_id = ?",
      [homeConversationId],
      true,
    );

    return row ? formatContext(row) : null;
  }

  async listForTeammate(teammateId: string, actorUserId: number): Promise<TeammateContext[]> {
    const rows = await this.runQuery<TeammateContextRow>(
      `SELECT * FROM teammate_context
       WHERE teammate_id = ? AND actor_user_id = ?
       ORDER BY updated_at DESC, created_at DESC`,
      [teammateId, actorUserId],
    );

    return rows.map(formatContext);
  }

  async listAllForTeammates(teammateIds: string[]): Promise<TeammateContext[]> {
    const ids = [...new Set(teammateIds)];

    if (ids.length === 0) {
      return [];
    }

    const rows = await this.runQuery<TeammateContextRow>(
      `SELECT * FROM teammate_context
       WHERE teammate_id IN (${ids.map(() => "?").join(", ")})
       ORDER BY created_at ASC`,
      ids,
    );

    return rows.map(formatContext);
  }

  async listForWorkspaceProjects(
    workspaceId: string,
    actorUserId?: number,
  ): Promise<TeammateContext[]> {
    const rows = await this.runQuery<TeammateContextRow>(
      `SELECT tc.* FROM teammate_context tc
       JOIN project p ON tc.scope_type = 'project' AND tc.scope_id = p.id
       WHERE p.workspace_id = ?${actorUserId === undefined ? "" : " AND tc.actor_user_id = ?"}
       ORDER BY tc.created_at ASC`,
      actorUserId === undefined ? [workspaceId] : [workspaceId, actorUserId],
    );

    return rows.map(formatContext);
  }

  async listForProjectTeammate(projectId: string, teammateId: string): Promise<TeammateContext[]> {
    const rows = await this.runQuery<TeammateContextRow>(
      `SELECT * FROM teammate_context
       WHERE scope_type = 'project' AND scope_id = ? AND teammate_id = ?
       ORDER BY created_at ASC`,
      [projectId, teammateId],
    );

    return rows.map(formatContext);
  }

  async updateStatus(
    id: string,
    status: TeammateContext["status"],
  ): Promise<TeammateContext | null> {
    const statements = [];

    if (status !== "active") {
      statements.push(
        this.env.DB.prepare(
          `UPDATE template
           SET status = 'paused',
               configuration = json_set(configuration, '$.status', 'paused'),
               updated_at = CURRENT_TIMESTAMP
           WHERE status = 'active'
             AND json_extract(configuration, '$.teammateContextId') = ?`,
        ).bind(id),
      );
    }

    if (status === "archived") {
      statements.push(
        this.env.DB.prepare("DELETE FROM teammate_connection_grant WHERE context_id = ?").bind(id),
      );
    }

    statements.push(
      this.env.DB.prepare(
        `UPDATE teammate_context
         SET status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      ).bind(status, id),
    );

    await this.executeBatch(statements);

    return this.getById(id);
  }

  async archiveContexts(ids: string[]): Promise<void> {
    const contextIds = [...new Set(ids)];

    if (contextIds.length === 0) {
      return;
    }

    const placeholders = contextIds.map(() => "?").join(", ");

    await this.executeBatch([
      this.env.DB.prepare(
        `UPDATE template
         SET status = 'paused',
             configuration = json_set(configuration, '$.status', 'paused'),
             updated_at = CURRENT_TIMESTAMP
         WHERE status = 'active'
           AND json_extract(configuration, '$.teammateContextId') IN (${placeholders})`,
      ).bind(...contextIds),
      this.env.DB.prepare(
        `DELETE FROM teammate_connection_grant WHERE context_id IN (${placeholders})`,
      ).bind(...contextIds),
      this.env.DB.prepare(
        `UPDATE teammate_context
         SET status = 'archived', updated_at = CURRENT_TIMESTAMP
         WHERE id IN (${placeholders})`,
      ).bind(...contextIds),
    ]);
  }

  async archiveForWorkspaceActor(workspaceId: string, actorUserId: number): Promise<void> {
    const contextIds = `SELECT tc.id FROM teammate_context tc
      JOIN project p ON tc.scope_type = 'project' AND tc.scope_id = p.id
      WHERE p.workspace_id = ? AND tc.actor_user_id = ?`;

    await this.executeBatch([
      this.env.DB.prepare(
        `UPDATE template
         SET status = 'paused',
             configuration = json_set(configuration, '$.status', 'paused'),
             updated_at = CURRENT_TIMESTAMP
         WHERE status = 'active'
           AND json_extract(configuration, '$.teammateContextId') IN (${contextIds})`,
      ).bind(workspaceId, actorUserId),
      this.env.DB.prepare(
        `DELETE FROM teammate_connection_grant WHERE context_id IN (${contextIds})`,
      ).bind(workspaceId, actorUserId),
      this.env.DB.prepare(
        `UPDATE teammate_context
         SET status = 'archived', updated_at = CURRENT_TIMESTAMP
         WHERE id IN (${contextIds})`,
      ).bind(workspaceId, actorUserId),
    ]);
  }

  async listConnectionGrants(contextId: string): Promise<TeammateConnectionGrant[]> {
    const rows = await this.runQuery<TeammateConnectionGrantRow>(
      `SELECT * FROM teammate_connection_grant
       WHERE context_id = ? ORDER BY created_at ASC`,
      [contextId],
    );

    return rows.map(formatGrant);
  }

  async upsertConnectionGrant(params: {
    contextId: string;
    connectionId: string;
    allowedOperations: string[];
    expectedRevision?: number;
  }): Promise<TeammateConnectionGrant | null> {
    const id = `teammate_grant_${generateId()}`;
    const row = await this.runQuery<TeammateConnectionGrantRow>(
      `INSERT INTO teammate_connection_grant (
         id, context_id, connection_id, allowed_operations, revision
       ) VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(context_id, connection_id) DO UPDATE SET
         allowed_operations = excluded.allowed_operations,
         revision = teammate_connection_grant.revision + 1,
         updated_at = CURRENT_TIMESTAMP
       WHERE ? IS NULL OR teammate_connection_grant.revision = ?
       RETURNING *`,
      [
        id,
        params.contextId,
        params.connectionId,
        JSON.stringify(params.allowedOperations),
        params.expectedRevision ?? null,
        params.expectedRevision ?? null,
      ],
      true,
    );

    return row ? formatGrant(row) : null;
  }
}
