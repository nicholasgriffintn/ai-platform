import type { ConversationLabel, ConversationSnooze } from "@ngriffin_uk/polychat-schemas";

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

export interface ConversationLabelRow {
  id: string;
  owner_user_id: number | null;
  project_id: string | null;
  name: string;
  normalised_name: string;
  created_by_user_id: number;
  created_at: string;
}

function formatLabel(row: ConversationLabelRow): ConversationLabel {
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

  async listLabels(userId: number, projectId: string | null): Promise<ConversationLabel[]> {
    const rows = projectId
      ? await this.runQuery<ConversationLabelRow>(
          `SELECT * FROM conversation_label
           WHERE project_id = ?
           ORDER BY normalised_name ASC, id ASC`,
          [projectId],
        )
      : await this.runQuery<ConversationLabelRow>(
          `SELECT * FROM conversation_label
           WHERE owner_user_id = ?
           ORDER BY normalised_name ASC, id ASC`,
          [userId],
        );

    return rows.map(formatLabel);
  }

  async listAssignedLabels(
    conversationId: string,
    userId: number,
    projectId: string | null,
  ): Promise<ConversationLabel[]> {
    const scopeClause = projectId ? "label.project_id = ?" : "label.owner_user_id = ?";
    const scopeValue = projectId ?? userId;
    const rows = await this.runQuery<ConversationLabelRow>(
      `SELECT label.*
       FROM conversation_label label
       JOIN conversation_label_assignment assignment ON assignment.label_id = label.id
       WHERE assignment.conversation_id = ? AND ${scopeClause}
       ORDER BY label.normalised_name ASC, label.id ASC`,
      [conversationId, scopeValue],
    );

    return rows.map(formatLabel);
  }

  async getLabel(labelId: string): Promise<ConversationLabelRow | null> {
    return this.runQuery<ConversationLabelRow>(
      "SELECT * FROM conversation_label WHERE id = ?",
      [labelId],
      true,
    );
  }

  async findLabelByName(params: {
    userId: number;
    projectId: string | null;
    normalisedName: string;
  }): Promise<ConversationLabelRow | null> {
    return params.projectId
      ? this.runQuery<ConversationLabelRow>(
          "SELECT * FROM conversation_label WHERE project_id = ? AND normalised_name = ?",
          [params.projectId, params.normalisedName],
          true,
        )
      : this.runQuery<ConversationLabelRow>(
          "SELECT * FROM conversation_label WHERE owner_user_id = ? AND normalised_name = ?",
          [params.userId, params.normalisedName],
          true,
        );
  }

  async createLabel(params: {
    userId: number;
    projectId: string | null;
    name: string;
  }): Promise<ConversationLabel> {
    const row = await this.runQuery<ConversationLabelRow>(
      `INSERT OR IGNORE INTO conversation_label (
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
        "A label with this name already exists",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    return formatLabel(row);
  }

  async deleteLabel(labelId: string): Promise<void> {
    await this.executeRun("DELETE FROM conversation_label WHERE id = ?", [labelId]);
  }

  async setLabelAssignment(params: {
    conversationId: string;
    labelId: string;
    userId: number;
    assigned: boolean;
  }): Promise<void> {
    if (params.assigned) {
      await this.executeRun(
        `INSERT OR IGNORE INTO conversation_label_assignment (
           conversation_id, label_id, assigned_by_user_id
         ) VALUES (?, ?, ?)`,
        [params.conversationId, params.labelId, params.userId],
      );

      return;
    }

    await this.executeRun(
      "DELETE FROM conversation_label_assignment WHERE conversation_id = ? AND label_id = ?",
      [params.conversationId, params.labelId],
    );
  }
}
