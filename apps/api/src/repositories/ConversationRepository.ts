import type {
  ConversationBranch,
  ConversationArchiveFilter,
  ConversationSortBy,
  ConversationType,
} from "@ngriffin_uk/polychat-schemas";
import { compareNaturalText, sortCopy } from "@ngriffin_uk/polychat-utility-core";

import { PaginationHelper } from "~/lib/database/PaginationHelper";
import { escapeSqlLikePattern } from "~/utils/sql";

import { BaseRepository } from "./BaseRepository";

export type { ConversationArchiveFilter, ConversationSortBy } from "@ngriffin_uk/polychat-schemas";

export interface GetUserConversationsOptions {
  archiveFilter?: ConversationArchiveFilter;
  limit?: number;
  page?: number;
  query?: string;
  sortBy?: ConversationSortBy;
  updatedAfter?: string;
}

export interface SetConversationsArchivedOptions {
  archived: boolean;
  query?: string;
  updatedAfter?: string;
}

export interface CreateConversationOptions {
  parent_conversation_id?: string;
  parent_message_id?: string;
  project_id?: string;
  type?: ConversationType;
}

export interface GlobalConversationSearchRow {
  id: string;
  title: string | null;
  updated_at: string | null;
  project_id: string | null;
  project_name: string | null;
  workspace_id: string | null;
  workspace_name: string | null;
  is_pinned: number;
  is_unread: number;
  snoozed_until: string | null;
  snoozed_next_response_at: string | null;
  next_response_arrived: number;
  labels: string;
}

export class ConversationRepository extends BaseRepository {
  public async createConversation(
    conversationId: string,
    userId: number,
    title?: string,
    options: CreateConversationOptions = {},
  ): Promise<Record<string, unknown> | null> {
    const parentConversationId = options.parent_conversation_id;
    const parentMessageId = options.parent_message_id;
    const projectId = options.project_id;
    const type = options.type ?? "chat";

    const result = this.runQuery<Record<string, unknown>>(
      `INSERT INTO conversation (
         id, 
         user_id, 
         type,
         title, 
         parent_conversation_id,
		 parent_message_id,
		 project_id,
         created_at, 
         updated_at
       )
		 VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
       RETURNING *`,
      [
        conversationId,
        userId,
        type,
        title ?? null,
        parentConversationId ?? null,
        parentMessageId ?? null,
        projectId ?? null,
      ],
      true,
    );

    return result;
  }

  public async getConversation(conversationId: string): Promise<Record<string, unknown> | null> {
    const conversation = await this.runQuery<Record<string, unknown>>(
      `SELECT c.*, EXISTS (
         SELECT 1 FROM conversation related
         WHERE (related.id = c.parent_conversation_id OR related.parent_conversation_id = c.id)
           AND related.id != c.id
           AND related.project_id IS c.project_id
           AND (c.project_id IS NOT NULL OR related.user_id = c.user_id)
       ) AS has_branches
       FROM conversation c WHERE c.id = ?`,
      [conversationId],
      true,
    );

    return conversation ? { ...conversation, has_branches: conversation.has_branches === 1 } : null;
  }

  public async listConversationBranches(
    conversationId: string,
    userId: number,
    projectId: string | null,
    limit: number,
  ): Promise<Array<Omit<ConversationBranch, "is_archived"> & { is_archived: number }>> {
    return this.runQuery(
      `WITH RECURSIVE scoped AS (
         SELECT id, parent_conversation_id FROM conversation
         WHERE project_id IS ? AND (? IS NOT NULL OR user_id = ?)
       ), family(id, parent_conversation_id) AS (
         SELECT id, parent_conversation_id FROM scoped WHERE id = ?
         UNION
         SELECT c.id, c.parent_conversation_id FROM scoped c JOIN family f ON c.id = f.parent_conversation_id
         UNION
         SELECT c.id, c.parent_conversation_id FROM scoped c JOIN family f ON c.parent_conversation_id = f.id
         LIMIT ?
       )
       SELECT c.id, c.title, c.parent_conversation_id, c.created_at, c.is_archived
       FROM conversation c JOIN family f ON c.id = f.id
       ORDER BY c.created_at ASC, c.id ASC`,
      [projectId, projectId, userId, conversationId, limit],
    );
  }

  public async getConversationByShareId(shareId: string): Promise<Record<string, unknown> | null> {
    const { query, values } = this.buildSelectQuery("conversation", {
      share_id: shareId,
    });

    return this.runQuery<Record<string, unknown>>(query, values, true);
  }

  public async getUserConversations(
    userId: number,
    optionsOrLimit: GetUserConversationsOptions | number = {},
    pageArg = 1,
    includeArchivedArg = false,
  ): Promise<{
    conversations: Record<string, unknown>[];
    total: number;
    totalPages: number;
    pageNumber: number;
    pageSize: number;
  }> {
    const options: GetUserConversationsOptions =
      typeof optionsOrLimit === "number"
        ? {
            archiveFilter: includeArchivedArg ? "all" : "active",
            limit: optionsOrLimit,
            page: pageArg,
          }
        : optionsOrLimit;
    const {
      archiveFilter = "active",
      limit = 25,
      page = 1,
      query,
      sortBy = "updated",
      updatedAfter,
    } = options;
    const { limit: safeLimit, offset } = PaginationHelper.calculate(page, limit);
    const whereClauses = [
      "c.user_id = ?",
      "c.project_id IS NULL",
      `NOT (
        COALESCE(datetime(state.snoozed_until) > datetime('now'), 0)
        OR (
          state.snoozed_next_response_at IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM message response
            WHERE response.conversation_id = c.id
              AND response.role = 'assistant'
              AND julianday(response.created_at) > julianday(state.snoozed_next_response_at)
          )
        )
      )`,
    ];
    const values: unknown[] = [userId];

    if (archiveFilter === "active") {
      whereClauses.push("c.is_archived = 0");
    } else if (archiveFilter === "archived") {
      whereClauses.push("c.is_archived = 1");
    }

    if (updatedAfter) {
      whereClauses.push(
        "datetime(COALESCE(c.updated_at, c.last_message_at, c.created_at)) >= datetime(?)",
      );
      values.push(updatedAfter);
    }

    const trimmedQuery = query?.trim();

    if (trimmedQuery) {
      whereClauses.push("c.title LIKE ? ESCAPE '\\'");
      values.push(`%${escapeSqlLikePattern(trimmedQuery)}%`);
    }

    const whereClause = whereClauses.join(" AND ");
    const orderByClause = `${sortBy === "created" ? "c.created_at" : "c.updated_at"} DESC, c.id DESC`;

    const countQuery = `SELECT COUNT(*) as total
      FROM conversation c
      LEFT JOIN conversation_user_state state
        ON state.conversation_id = c.id AND state.user_id = ?
      WHERE ${whereClause}`;

    const countResult = await this.runQuery<{ total: number }>(
      countQuery,
      [userId, ...values],
      true,
    );

    const total = countResult?.total || 0;
    const totalPages = Math.ceil(total / safeLimit);

    const listQuery =
      sortBy === "title"
        ? `
        SELECT c.*,
          COALESCE(state.is_pinned, 0) AS is_pinned,
          COALESCE(state.is_unread, 0) AS is_unread,
          state.snoozed_until,
          state.snoozed_next_response_at,
          COALESCE((
            SELECT json_group_array(json_object(
              'id', label.id,
              'name', label.name,
              'scope', json_object('kind', 'personal')
            ))
            FROM conversation_label_assignment assignment
            JOIN conversation_label label ON label.id = assignment.label_id
            WHERE assignment.conversation_id = c.id AND label.owner_user_id = c.user_id
          ), '[]') AS labels
        FROM conversation c
        LEFT JOIN conversation_user_state state
          ON state.conversation_id = c.id AND state.user_id = ?
        WHERE ${whereClause}
      `
        : `
        SELECT c.*,
          COALESCE(state.is_pinned, 0) AS is_pinned,
          COALESCE(state.is_unread, 0) AS is_unread,
          state.snoozed_until,
          state.snoozed_next_response_at,
          COALESCE((
            SELECT json_group_array(json_object(
              'id', label.id,
              'name', label.name,
              'scope', json_object('kind', 'personal')
            ))
            FROM conversation_label_assignment assignment
            JOIN conversation_label label ON label.id = assignment.label_id
            WHERE assignment.conversation_id = c.id AND label.owner_user_id = c.user_id
          ), '[]') AS labels
        FROM conversation c
        LEFT JOIN conversation_user_state state
          ON state.conversation_id = c.id AND state.user_id = ?
        WHERE ${whereClause}
        ORDER BY COALESCE(state.is_pinned, 0) DESC, ${orderByClause}
        LIMIT ? OFFSET ?
      `;

    const queryValues =
      sortBy === "title" ? [userId, ...values] : [userId, ...values, safeLimit, offset];
    const results = await this.runQuery<Record<string, unknown>>(listQuery, queryValues);
    const conversations =
      sortBy === "title"
        ? sortCopy(
            sortCopy(results, (left, right) => {
              const leftTitle = typeof left.title === "string" ? left.title : "New conversation";
              const rightTitle = typeof right.title === "string" ? right.title : "New conversation";
              const leftId = typeof left.id === "string" ? left.id : "";
              const rightId = typeof right.id === "string" ? right.id : "";

              return (
                compareNaturalText(leftTitle, rightTitle) || compareNaturalText(rightId, leftId)
              );
            }),
            (left, right) => Number(Boolean(right.is_pinned)) - Number(Boolean(left.is_pinned)),
          ).slice(offset, offset + safeLimit)
        : results;

    return {
      conversations,
      total,
      totalPages,
      pageNumber: page,
      pageSize: safeLimit,
    };
  }

  public async setPersonalConversationsArchived(
    userId: number,
    options: SetConversationsArchivedOptions,
  ): Promise<number> {
    const { archived, query, updatedAfter } = options;
    const whereClauses = ["user_id = ?", "project_id IS NULL", "is_archived = ?"];
    const values: unknown[] = [archived ? 1 : 0, userId, archived ? 0 : 1];

    const trimmedQuery = query?.trim();

    if (trimmedQuery) {
      whereClauses.push("title LIKE ? ESCAPE '\\'");
      values.push(`%${escapeSqlLikePattern(trimmedQuery)}%`);
    }

    if (updatedAfter) {
      whereClauses.push(
        "datetime(COALESCE(updated_at, last_message_at, created_at)) >= datetime(?)",
      );
      values.push(updatedAfter);
    }

    const result = await this.executeRun(
      `UPDATE conversation
		 SET is_archived = ?, updated_at = datetime('now')
		 WHERE ${whereClauses.join(" AND ")}`,
      values,
    );

    return result?.meta?.changes ?? 0;
  }

  public async updateConversation(
    conversationId: string,
    updates: Record<string, unknown>,
  ): Promise<D1Result | null> {
    const allowedFields = [
      "title",
      "is_archived",
      "last_message_id",
      "last_message_at",
      "message_count",
      "is_public",
      "share_id",
    ];

    const result = this.buildUpdateQuery("conversation", updates, allowedFields, "id = ?", [
      conversationId,
    ]);

    if (!result) {
      return null;
    }

    return this.executeRun(result.query, result.values);
  }

  public async deleteConversation(conversationId: string): Promise<void> {
    const deleteMessages = this.buildDeleteQuery("message", {
      conversation_id: conversationId,
    });

    if (deleteMessages.query) {
      await this.executeRun(deleteMessages.query, deleteMessages.values);
    }

    const deleteConversation = this.buildDeleteQuery("conversation", {
      id: conversationId,
    });

    if (deleteConversation.query) {
      await this.executeRun(deleteConversation.query, deleteConversation.values);
    }
  }

  public async deleteAllPersonalConversations(userId: number): Promise<void> {
    const personalConversationIds =
      "SELECT id FROM conversation WHERE user_id = ? AND project_id IS NULL";
    const database = this.env.DB;

    await database.batch([
      database
        .prepare(
          `UPDATE conversation
					 SET parent_conversation_id = NULL, parent_message_id = NULL
					 WHERE parent_conversation_id IN (${personalConversationIds})`,
        )
        .bind(userId),
      database
        .prepare(
          `DELETE FROM training_examples
					 WHERE conversation_id IN (${personalConversationIds})`,
        )
        .bind(userId),
      database
        .prepare(
          `DELETE FROM message
					 WHERE conversation_id IN (${personalConversationIds})`,
        )
        .bind(userId),
      database
        .prepare("DELETE FROM conversation WHERE user_id = ? AND project_id IS NULL")
        .bind(userId),
    ]);
  }

  public async searchAccessibleConversations(
    userId: number,
    query: string,
    limit: number,
  ): Promise<GlobalConversationSearchRow[]> {
    const trimmedQuery = query.trim();
    const searchTerm = `%${escapeSqlLikePattern(trimmedQuery)}%`;

    return this.runQuery<GlobalConversationSearchRow>(
      `SELECT c.id, c.title, c.updated_at, c.project_id,
			        p.name AS project_name, w.id AS workspace_id, w.name AS workspace_name,
              COALESCE(state.is_pinned, 0) AS is_pinned,
              COALESCE(state.is_unread, 0) AS is_unread,
              state.snoozed_until,
              state.snoozed_next_response_at,
              EXISTS (
                SELECT 1 FROM message response
                WHERE response.conversation_id = c.id
                  AND response.role = 'assistant'
                  AND state.snoozed_next_response_at IS NOT NULL
                  AND julianday(response.created_at) > julianday(state.snoozed_next_response_at)
              ) AS next_response_arrived,
              COALESCE((
                SELECT json_group_array(json_object(
                  'id', label.id,
                  'name', label.name,
                  'scope', CASE
                    WHEN label.project_id IS NOT NULL
                    THEN json_object('kind', 'project', 'projectId', label.project_id)
                    ELSE json_object('kind', 'personal')
                  END
                ))
                FROM conversation_label_assignment assignment
                JOIN conversation_label label ON label.id = assignment.label_id
                WHERE assignment.conversation_id = c.id
                  AND (label.project_id = c.project_id OR label.owner_user_id = ?)
              ), '[]') AS labels
			 FROM conversation c
			 LEFT JOIN project p ON p.id = c.project_id AND p.archived_at IS NULL
			 LEFT JOIN workspace w ON w.id = p.workspace_id
			 LEFT JOIN conversation_user_state state
         ON state.conversation_id = c.id AND state.user_id = ?
			 WHERE c.is_archived = 0
			   AND (
			     (c.project_id IS NULL AND c.user_id = ?)
			     OR (
			       c.project_id IS NOT NULL
			       AND p.id IS NOT NULL
			       AND EXISTS (
			         SELECT 1 FROM workspace_member wm
			         WHERE wm.workspace_id = p.workspace_id AND wm.user_id = ?
			       )
			     )
			   )
			   AND (
           ? = ''
           OR c.title LIKE ? ESCAPE '\\'
           OR EXISTS (
             SELECT 1
             FROM conversation_label_assignment assignment
             JOIN conversation_label label ON label.id = assignment.label_id
             WHERE assignment.conversation_id = c.id
               AND (label.project_id = c.project_id OR label.owner_user_id = ?)
               AND label.name LIKE ? ESCAPE '\\'
           )
         )
			 ORDER BY COALESCE(state.is_pinned, 0) DESC,
         COALESCE(c.updated_at, c.created_at) DESC, c.id DESC
			 LIMIT ?`,
      [userId, userId, userId, userId, trimmedQuery, searchTerm, userId, searchTerm, limit],
    );
  }
}
