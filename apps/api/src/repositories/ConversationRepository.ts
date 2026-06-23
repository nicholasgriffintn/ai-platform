import { PaginationHelper } from "~/lib/database/PaginationHelper";
import { escapeSqlLikePattern } from "~/utils/sql";
import { BaseRepository } from "./BaseRepository";

export type ConversationArchiveFilter = "active" | "archived" | "all";
export type ConversationSortBy = "created" | "updated";

export interface GetUserConversationsOptions {
	archiveFilter?: ConversationArchiveFilter;
	limit?: number;
	page?: number;
	query?: string;
	sortBy?: ConversationSortBy;
}

export class ConversationRepository extends BaseRepository {
	public async createConversation(
		conversationId: string,
		userId: number,
		title?: string,
		options: Record<string, unknown> = {},
	): Promise<Record<string, unknown> | null> {
		const parentConversationId = options.parent_conversation_id;
		const parentMessageId = options.parent_message_id;

		const result = this.runQuery<Record<string, unknown>>(
			`INSERT INTO conversation (
         id, 
         user_id, 
         title, 
         parent_conversation_id,
         parent_message_id,
         created_at, 
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
       RETURNING *`,
			[
				conversationId,
				userId,
				title ?? null,
				parentConversationId ?? null,
				parentMessageId ?? null,
			],
			true,
		);
		return result;
	}

	public async getConversation(conversationId: string): Promise<Record<string, unknown> | null> {
		const { query, values } = this.buildSelectQuery("conversation", {
			id: conversationId,
		});
		return this.runQuery<Record<string, unknown>>(query, values, true);
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
		const { archiveFilter = "active", limit = 25, page = 1, query, sortBy = "updated" } = options;
		const { limit: safeLimit, offset } = PaginationHelper.calculate(page, limit);
		const whereClauses = ["c.user_id = ?"];
		const values: unknown[] = [userId];

		if (archiveFilter === "active") {
			whereClauses.push("c.is_archived = 0");
		} else if (archiveFilter === "archived") {
			whereClauses.push("c.is_archived = 1");
		}

		const trimmedQuery = query?.trim();
		if (trimmedQuery) {
			whereClauses.push("c.title LIKE ? ESCAPE '\\'");
			values.push(`%${escapeSqlLikePattern(trimmedQuery)}%`);
		}

		const whereClause = whereClauses.join(" AND ");
		const orderByColumn = sortBy === "created" ? "c.created_at" : "c.updated_at";

		const countQuery = `SELECT COUNT(*) as total FROM conversation c WHERE ${whereClause}`;

		const countResult = (await this.runQuery<{ total: number }>(countQuery, values, true)) as {
			total: number;
		} | null;

		const total = countResult?.total || 0;
		const totalPages = Math.ceil(total / safeLimit);

		const listQuery = `
        SELECT c.*,
        (SELECT GROUP_CONCAT(m.id) FROM message m WHERE m.conversation_id = c.id) as messages
        FROM conversation c
        WHERE ${whereClause}
        ORDER BY ${orderByColumn} DESC, c.id DESC
        LIMIT ? OFFSET ?
      `;

		const conversations = (await this.runQuery<Record<string, unknown>>(listQuery, [
			...values,
			safeLimit,
			offset,
		])) as Record<string, unknown>[];

		return {
			conversations,
			totalPages,
			pageNumber: page,
			pageSize: safeLimit,
		};
	}

	public async updateConversation(
		conversationId: string,
		updates: Record<string, unknown>,
	): Promise<D1Result<unknown> | null> {
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

	public async updateConversationAfterMessage(
		conversationId: string,
		messageId: string,
	): Promise<void> {
		await this.executeRun(
			`UPDATE conversation 
       SET 
         last_message_id = ?,
         last_message_at = datetime('now'),
         message_count = message_count + 1,
         updated_at = datetime('now')
       WHERE id = ?`,
			[messageId, conversationId],
		);
	}

	public async searchConversations(
		userId: number,
		query: string,
		limit = 25,
		offset = 0,
	): Promise<Record<string, unknown>[]> {
		const searchTerm = `%${query}%`;

		const result = await this.runQuery<Record<string, unknown>>(
			`SELECT c.* 
       FROM conversation c
       WHERE c.user_id = ?
       AND (
         c.title LIKE ?
         OR c.id IN (
           SELECT DISTINCT conversation_id 
           FROM message 
           WHERE content LIKE ?
         )
       )
       ORDER BY c.updated_at DESC
       LIMIT ? OFFSET ?`,
			[userId, searchTerm, searchTerm, limit, offset],
		);

		return Array.isArray(result) ? result : [];
	}
}
