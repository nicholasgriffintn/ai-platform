import { BaseRepository } from "./BaseRepository";
import { nonEmptyToolCallsOrNull } from "~/utils/toolCalls";

const LIVE_TURN_ORDER_EXPRESSION =
	"CASE WHEN json_valid(data) THEN CAST(json_extract(data, '$.realtime.turnStartedAt') AS INTEGER) END";
const LIVE_SEQUENCE_ORDER_EXPRESSION =
	"CASE WHEN json_valid(data) THEN CAST(json_extract(data, '$.realtime.sequence') AS INTEGER) END";
const MESSAGE_ORDER_EXPRESSION = `COALESCE(${LIVE_TURN_ORDER_EXPRESSION}, timestamp, CAST(strftime('%s', created_at) AS INTEGER) * 1000)`;
const MESSAGE_SEQUENCE_EXPRESSION = `COALESCE(${LIVE_SEQUENCE_ORDER_EXPRESSION}, 0)`;
const MESSAGE_TIMESTAMP_TIE_EXPRESSION = "COALESCE(timestamp, 0)";
const MESSAGE_ORDER_BY = `${MESSAGE_ORDER_EXPRESSION} ASC, ${MESSAGE_SEQUENCE_EXPRESSION} ASC, ${MESSAGE_TIMESTAMP_TIE_EXPRESSION} ASC, created_at ASC, id ASC`;

export class MessageRepository extends BaseRepository {
	public async createMessage(
		messageId: string,
		conversationId: string,
		role: string,
		content: string | Record<string, unknown>,
		messageData: Record<string, unknown> = {},
	): Promise<Record<string, unknown> | null> {
		const contentStr = typeof content === "object" ? JSON.stringify(content) : content;

		const toolCallsData = nonEmptyToolCallsOrNull(messageData.tool_calls);
		const toolCalls = toolCallsData ? JSON.stringify(toolCallsData) : null;
		const citations = messageData.citations ? JSON.stringify(messageData.citations) : null;
		const data = messageData.data ? JSON.stringify(messageData.data) : null;
		const usage = messageData.usage ? JSON.stringify(messageData.usage) : null;
		const parts = messageData.parts ? JSON.stringify(messageData.parts) : null;

		const result = this.runQuery<Record<string, unknown>>(
			`INSERT INTO message (
         id, 
         conversation_id, 
         parent_message_id,
         role, 
         content, 
         name,
         tool_calls,
         citations,
         model,
         status,
         timestamp,
         platform,
         mode,
         log_id,
         data,
         usage,
         tool_call_id,
         tool_call_arguments,
         app,
         parts,
         created_at, 
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
       RETURNING *`,
			[
				messageId,
				conversationId,
				messageData.parent_message_id || null,
				role,
				contentStr,
				messageData.name || null,
				toolCalls,
				citations,
				messageData.model || null,
				messageData.status || null,
				messageData.timestamp || null,
				messageData.platform || null,
				messageData.mode || null,
				messageData.log_id || null,
				data,
				usage,
				messageData.tool_call_id || null,
				messageData.tool_call_arguments || null,
				messageData.app || null,
				parts,
			],
			true,
		);
		return result;
	}

	public async getMessage(messageId: string): Promise<Record<string, unknown> | null> {
		const result = this.runQuery<Record<string, unknown>>(
			"SELECT * FROM message WHERE id = ?",
			[messageId],
			true,
		);
		return result;
	}

	public async getConversationMessages(
		conversationId: string,
		limit = 50,
		after?: string,
		options?: {
			includeArchived?: boolean;
		},
	): Promise<Record<string, unknown>[]> {
		const includeArchived = options?.includeArchived ?? false;
		const archivedClause = includeArchived ? "" : " AND is_archived = 0";
		let query = `
      SELECT * FROM message WHERE conversation_id = ?${archivedClause}
      ORDER BY ${MESSAGE_ORDER_BY}
    `;

		const params: Array<string | number> = [conversationId];

		if (after) {
			query = `
        WITH cursor_message AS (
          SELECT
            ${MESSAGE_ORDER_EXPRESSION} AS cursor_order_value,
            ${MESSAGE_SEQUENCE_EXPRESSION} AS cursor_sequence_value,
            ${MESSAGE_TIMESTAMP_TIE_EXPRESSION} AS cursor_timestamp_value,
            created_at AS cursor_created_at,
            id AS cursor_id
          FROM message
          WHERE conversation_id = ? AND id = ?
        )
        SELECT message.* FROM message, cursor_message
        WHERE conversation_id = ?${archivedClause}
        AND (
          ${MESSAGE_ORDER_EXPRESSION} > cursor_order_value
          OR (
            ${MESSAGE_ORDER_EXPRESSION} = cursor_order_value
            AND ${MESSAGE_SEQUENCE_EXPRESSION} > cursor_sequence_value
          )
          OR (
            ${MESSAGE_ORDER_EXPRESSION} = cursor_order_value
            AND ${MESSAGE_SEQUENCE_EXPRESSION} = cursor_sequence_value
            AND ${MESSAGE_TIMESTAMP_TIE_EXPRESSION} > cursor_timestamp_value
          )
          OR (
            ${MESSAGE_ORDER_EXPRESSION} = cursor_order_value
            AND ${MESSAGE_SEQUENCE_EXPRESSION} = cursor_sequence_value
            AND ${MESSAGE_TIMESTAMP_TIE_EXPRESSION} = cursor_timestamp_value
            AND created_at > cursor_created_at
          )
          OR (
            ${MESSAGE_ORDER_EXPRESSION} = cursor_order_value
            AND ${MESSAGE_SEQUENCE_EXPRESSION} = cursor_sequence_value
            AND ${MESSAGE_TIMESTAMP_TIE_EXPRESSION} = cursor_timestamp_value
            AND created_at = cursor_created_at
            AND id > cursor_id
          )
        )
        ORDER BY ${MESSAGE_ORDER_BY}
      `;
			params.length = 0;
			params.push(conversationId, after, conversationId);
		}

		if (limit) {
			query += " LIMIT ?";
			params.push(limit);
		}

		const result = await this.runQuery<Record<string, unknown>>(query, params);
		return Array.isArray(result) ? result : [];
	}

	public async getMessages(
		conversationId: string,
		limit = 50,
		after?: string,
		options?: {
			includeArchived?: boolean;
		},
	): Promise<Record<string, unknown>[]> {
		return this.getConversationMessages(conversationId, limit, after, options);
	}

	public async archiveMessages(conversationId: string, messageIds: string[]): Promise<void> {
		if (messageIds.length === 0) {
			return;
		}

		const placeholders = messageIds.map(() => "?").join(", ");
		await this.executeRun(
			`UPDATE message
			 SET is_archived = 1,
			     updated_at = datetime('now')
			 WHERE conversation_id = ?
			   AND id IN (${placeholders})`,
			[conversationId, ...messageIds],
		);
	}

	public async updateMessage(messageId: string, updates: Record<string, unknown>): Promise<void> {
		const allowedFields = [
			"is_archived",
			"content",
			"status",
			"tool_calls",
			"citations",
			"log_id",
			"data",
			"parent_message_id",
			"tool_call_id",
			"tool_call_arguments",
			"app",
			"mode",
			"platform",
			"model",
			"name",
			"timestamp",
			"usage",
			"parts",
		];

		const result = this.buildUpdateQuery("message", updates, allowedFields, "id = ?", [messageId], {
			jsonFields: ["tool_calls", "citations", "data", "usage", "parts"],
			transformer: (field, value) => {
				if (field === "content" && typeof value === "object") {
					return JSON.stringify(value);
				}
				return value;
			},
		});
		if (!result) {
			return;
		}

		await this.executeRun(result.query, result.values);
	}

	public async deleteMessage(messageId: string): Promise<void> {
		const { query, values } = this.buildDeleteQuery("message", {
			id: messageId,
		});
		if (!query) {
			return;
		}
		await this.executeRun(query, values);
	}

	public async deleteAllMessages(conversationId: string): Promise<void> {
		const { query, values } = this.buildDeleteQuery("message", {
			conversation_id: conversationId,
		});
		if (!query) {
			return;
		}
		await this.executeRun(query, values);
	}

	public async getChildMessages(
		parentMessageId: string,
		limit = 50,
	): Promise<Record<string, unknown>[]> {
		const result = await this.runQuery<Record<string, unknown>>(
			`SELECT * FROM message 
       WHERE parent_message_id = ?
       ORDER BY created_at ASC 
       LIMIT ?`,
			[parentMessageId, limit],
		);
		return Array.isArray(result) ? result : [];
	}

	public async searchMessages(
		userId: number,
		query: string,
		limit = 25,
		offset = 0,
	): Promise<Record<string, unknown>[]> {
		const searchTerm = `%${query}%`;

		const result = await this.runQuery<Record<string, unknown>>(
			`SELECT m.* 
       FROM message m
       JOIN conversation c ON m.conversation_id = c.id
       WHERE c.user_id = ?
       AND m.content LIKE ?
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`,
			[userId, searchTerm, limit, offset],
		);
		return Array.isArray(result) ? result : [];
	}

	public async getMessageById(messageId: string): Promise<{
		message: Record<string, unknown>;
		conversation_id: string;
		user_id: number;
	} | null> {
		const result = (await this.runQuery<Record<string, unknown>>(
			`SELECT m.*, c.id as conversation_id, c.user_id 
       FROM message m
       JOIN conversation c ON m.conversation_id = c.id
       WHERE m.id = ?`,
			[messageId],
			true,
		)) as Record<string, unknown> | null;

		if (!result) {
			return null;
		}

		return {
			message: {
				id: result.id,
				role: result.role,
				content: result.content,
				model: result.model,
				name: result.name,
				tool_calls: result.tool_calls,
				citations: result.citations,
				status: result.status,
				timestamp: result.timestamp,
				platform: result.platform,
				mode: result.mode,
				is_archived: result.is_archived,
				data: result.data,
				parts: result.parts,
				usage: result.usage,
				log_id: result.log_id,
			},
			conversation_id: result.conversation_id as string,
			user_id: result.user_id as number,
		};
	}
}
