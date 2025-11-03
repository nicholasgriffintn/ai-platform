import { BaseRepository } from "./BaseRepository";

export class MessageRepository extends BaseRepository {
	public async createMessage(
		messageId: string,
		conversationId: string,
		role: string,
		content: string | Record<string, unknown>,
		messageData: Record<string, unknown> = {},
	): Promise<Record<string, unknown> | null> {
		const contentStr =
			typeof content === "object" ? JSON.stringify(content) : content;

		const toolCalls = messageData.tool_calls
			? JSON.stringify(messageData.tool_calls)
			: null;
		const citations = messageData.citations
			? JSON.stringify(messageData.citations)
			: null;
		const data = messageData.data ? JSON.stringify(messageData.data) : null;
		const usage = messageData.usage ? JSON.stringify(messageData.usage) : null;

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
				messageData.parts || null,
			],
			true,
		);
		return result;
	}

	public async getMessage(
		messageId: string,
	): Promise<Record<string, unknown> | null> {
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
	): Promise<Record<string, unknown>[]> {
		let query = `
      SELECT * FROM message WHERE conversation_id = ?
      ORDER BY created_at ASC
    `;

		const params: Array<string | number> = [conversationId];

		if (after) {
			query = `
        SELECT * FROM message
        WHERE conversation_id = ? AND id > ?
        ORDER BY created_at ASC
      `;
			params.push(after);
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
	): Promise<Record<string, unknown>[]> {
		return this.getConversationMessages(conversationId, limit, after);
	}

	public async updateMessage(
		messageId: string,
		updates: Record<string, unknown>,
	): Promise<void> {
		const allowedFields = [
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

		const result = this.buildUpdateQuery(
			"message",
			updates,
			allowedFields,
			"id = ?",
			[messageId],
			{
				jsonFields: ["tool_calls", "citations", "data", "usage"],
				transformer: (field, value) => {
					if (field === "content" && typeof value === "object") {
						return JSON.stringify(value);
					}
					return value;
				},
			},
		);
		if (!result) {
			return;
		}

		await this.executeRun(result.query, result.values);
	}

	public async deleteMessage(messageId: string): Promise<void> {
		const { query, values } = this.buildDeleteQuery(
			"message",
			{ id: messageId },
		);
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
				data: result.data,
				usage: result.usage,
				log_id: result.log_id,
			},
			conversation_id: result.conversation_id as string,
			user_id: result.user_id as number,
		};
	}
}
