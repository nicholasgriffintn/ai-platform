import type { ConversationGroup, ConversationSnooze } from "@ngriffin_uk/polychat-schemas";

import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { BaseRepository } from "./BaseRepository";

export interface ConversationUserStateRow {
  conversation_id: string;
  user_id: number;
  is_pinned: number;
  is_unread: number;
  snoozed_until: string | null;
  snoozed_next_response_at: string | null;
  revision: number;
  updated_at: string | null;
  next_response_arrived: number;
}

export interface ConversationGroupRow {
  id: string;
  owner_user_id: number | null;
  project_id: string | null;
  name: string;
  normalised_name: string;
  created_by_user_id: number;
  created_at: string;
}

function formatGroup(row: ConversationGroupRow): ConversationGroup {
  return {
    id: row.id,
    name: row.name,
    scope: row.project_id ? { kind: "project", projectId: row.project_id } : { kind: "personal" },
  };
}

export class ConversationOrganisationRepository extends BaseRepository {
  async getState(conversationId: string, userId: number): Promise<ConversationUserStateRow | null> {
    return this.runQuery<ConversationUserStateRow>(
      `SELECT state.*,
        EXISTS (
          SELECT 1 FROM message response
          WHERE response.conversation_id = state.conversation_id
            AND response.role = 'assistant'
            AND state.snoozed_next_response_at IS NOT NULL
            AND julianday(response.created_at) > julianday(state.snoozed_next_response_at)
        ) AS next_response_arrived
       FROM conversation_user_state state
       WHERE state.conversation_id = ? AND state.user_id = ?`,
      [conversationId, userId],
      true,
    );
  }

  async putState(params: {
    conversationId: string;
    userId: number;
    expectedRevision: number;
    isPinned: boolean;
    isUnread: boolean;
    snooze: ConversationSnooze | null;
    updatedAt: string;
  }): Promise<ConversationUserStateRow | null> {
    const snoozedUntil = params.snooze?.kind === "until" ? params.snooze.until : null;
    const snoozedNextResponseAt = params.snooze?.kind === "next_response" ? params.updatedAt : null;

    return this.runQuery<ConversationUserStateRow>(
      `INSERT INTO conversation_user_state (
         conversation_id, user_id, is_pinned, is_unread, snoozed_until,
         snoozed_next_response_at, revision, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
       ON CONFLICT(conversation_id, user_id) DO UPDATE SET
         is_pinned = excluded.is_pinned,
         is_unread = excluded.is_unread,
         snoozed_until = excluded.snoozed_until,
         snoozed_next_response_at = excluded.snoozed_next_response_at,
         revision = conversation_user_state.revision + 1,
         updated_at = excluded.updated_at
       WHERE conversation_user_state.revision = ?
       RETURNING *, 0 AS next_response_arrived`,
      [
        params.conversationId,
        params.userId,
        params.isPinned ? 1 : 0,
        params.isUnread ? 1 : 0,
        snoozedUntil,
        snoozedNextResponseAt,
        params.updatedAt,
        params.expectedRevision,
      ],
      true,
    );
  }

  async listGroups(userId: number, projectId: string | null): Promise<ConversationGroup[]> {
    const rows = projectId
      ? await this.runQuery<ConversationGroupRow>(
          `SELECT * FROM conversation_group
           WHERE project_id = ?
           ORDER BY normalised_name ASC, id ASC`,
          [projectId],
        )
      : await this.runQuery<ConversationGroupRow>(
          `SELECT * FROM conversation_group
           WHERE owner_user_id = ?
           ORDER BY normalised_name ASC, id ASC`,
          [userId],
        );

    return rows.map(formatGroup);
  }

  async getConversationGroup(
    conversationId: string,
    userId: number,
    projectId: string | null,
  ): Promise<ConversationGroup | null> {
    const scopeClause = projectId ? "grp.project_id = ?" : "grp.owner_user_id = ?";
    const scopeValue = projectId ?? userId;
    const row = await this.runQuery<ConversationGroupRow>(
      `SELECT grp.*
       FROM conversation_group grp
       JOIN conversation_group_membership membership ON membership.group_id = grp.id
       WHERE membership.conversation_id = ? AND ${scopeClause}`,
      [conversationId, scopeValue],
      true,
    );

    return row ? formatGroup(row) : null;
  }

  async getGroup(groupId: string): Promise<ConversationGroupRow | null> {
    return this.runQuery<ConversationGroupRow>(
      "SELECT * FROM conversation_group WHERE id = ?",
      [groupId],
      true,
    );
  }

  async findGroupByName(params: {
    userId: number;
    projectId: string | null;
    normalisedName: string;
  }): Promise<ConversationGroupRow | null> {
    return params.projectId
      ? this.runQuery<ConversationGroupRow>(
          "SELECT * FROM conversation_group WHERE project_id = ? AND normalised_name = ?",
          [params.projectId, params.normalisedName],
          true,
        )
      : this.runQuery<ConversationGroupRow>(
          "SELECT * FROM conversation_group WHERE owner_user_id = ? AND normalised_name = ?",
          [params.userId, params.normalisedName],
          true,
        );
  }

  async createGroup(params: {
    userId: number;
    projectId: string | null;
    name: string;
  }): Promise<ConversationGroup> {
    const row = await this.runQuery<ConversationGroupRow>(
      `INSERT OR IGNORE INTO conversation_group (
         id, owner_user_id, project_id, name, normalised_name, created_by_user_id
       ) VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [
        generateId(),
        params.projectId ? null : params.userId,
        params.projectId,
        params.name,
        params.name.toLowerCase(),
        params.userId,
      ],
      true,
    );

    if (!row) {
      throw new AssistantError(
        "A group with this name already exists",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    return formatGroup(row);
  }

  async deleteGroup(groupId: string): Promise<void> {
    await this.executeRun("DELETE FROM conversation_group WHERE id = ?", [groupId]);
  }

  async setConversationGroup(params: {
    conversationId: string;
    groupId: string | null;
    userId: number;
  }): Promise<void> {
    if (params.groupId) {
      await this.executeRun(
        `INSERT INTO conversation_group_membership (
           conversation_id, group_id, assigned_by_user_id
         ) VALUES (?, ?, ?)
         ON CONFLICT(conversation_id) DO UPDATE SET
           group_id = excluded.group_id,
           assigned_by_user_id = excluded.assigned_by_user_id,
           created_at = CURRENT_TIMESTAMP`,
        [params.conversationId, params.groupId, params.userId],
      );

      return;
    }

    await this.executeRun("DELETE FROM conversation_group_membership WHERE conversation_id = ?", [
      params.conversationId,
    ]);
  }
}
