import type { D1Database } from "@cloudflare/workers-types";

import { AssistantError } from "../utils/errors";

export class Database {
	private db: D1Database;
	private static instance: Database;

	private constructor(db: D1Database) {
		if (!db) {
			throw new Error("Database not configured");
		}

		this.db = db;
	}

	public static getInstance(db: D1Database): Database {
		if (!Database.instance) {
			Database.instance = new Database(db);
		}
		return Database.instance;
	}

	public async getUserByGithubId(
		githubId: string,
	): Promise<Record<string, unknown> | null> {
		const result = await this.db
			.prepare(`
      SELECT u.* FROM user u
      JOIN oauth_account oa ON u.id = oa.user_id
      WHERE oa.provider_id = 'github' AND oa.provider_user_id = ?
    `)
			.bind(githubId)
			.first();

		return result;
	}

	public async getUserBySessionId(
		sessionId: string,
	): Promise<Record<string, unknown> | null> {
		const result = await this.db
			.prepare(`
      SELECT u.* FROM user u
      JOIN session s ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > datetime('now')
    `)
			.bind(sessionId)
			.first();

		return result;
	}

	public async getUserById(
		userId: number,
	): Promise<Record<string, unknown> | null> {
		const result = await this.db
			.prepare(`
      SELECT * FROM user WHERE id = ?
    `)
			.bind(userId)
			.first();

		return result;
	}

	public async getUserByEmail(
		email: string,
	): Promise<Record<string, unknown> | null> {
		const result = await this.db
			.prepare("SELECT * FROM user WHERE email = ?")
			.bind(email)
			.first();

		return result;
	}

	public async updateUser(
		userId: number,
		userData: Record<string, unknown>,
	): Promise<void> {
		const result = await this.db
			.prepare(`
        UPDATE user 
        SET 
          name = ?, 
          avatar_url = ?, 
          email = ?, 
          github_username = ?,
          company = ?,
          location = ?,
          bio = ?,
          twitter_username = ?,
          site = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `)
			.bind(
				userData.name || null,
				userData.avatarUrl || null,
				userData.email,
				userData.username,
				userData.company || null,
				userData.location || null,
				userData.bio || null,
				userData.twitterUsername || null,
				userData.site || null,
				userId,
			)
			.run();

		if (!result.success) {
			throw new AssistantError("Error updating user in the database");
		}
	}

	public async createOauthAccount(
		userId: number,
		providerId: string,
		providerUserId: string,
	): Promise<void> {
		const result = await this.db
			.prepare(`
          INSERT INTO oauth_account (provider_id, provider_user_id, user_id)
          VALUES ('github', ?, ?)
        `)
			.bind(providerId, providerUserId, userId)
			.run();

		if (!result.success) {
			throw new AssistantError("Error creating oauth account in the database");
		}
	}

	public async updateUserWithGithubData(
		userId: number,
		userData: Record<string, unknown>,
	): Promise<void> {
		const result = await this.db
			.prepare(`
          UPDATE user 
          SET 
            github_username = ?,
            name = COALESCE(?, name),
            avatar_url = COALESCE(?, avatar_url),
            company = COALESCE(?, company),
            location = COALESCE(?, location),
            bio = COALESCE(?, bio),
            twitter_username = COALESCE(?, twitter_username),
            site = COALESCE(?, site),
            updated_at = datetime('now')
          WHERE id = ?
        `)
			.bind(
				userData.username,
				userData.name || null,
				userData.avatarUrl || null,
				userData.company || null,
				userData.location || null,
				userData.bio || null,
				userData.twitterUsername || null,
				userData.site || null,
				userId,
			)
			.run();

		if (!result.success) {
			throw new AssistantError("Error creating github user in the database");
		}
	}

	public async createUser(
		userData: Record<string, unknown>,
	): Promise<Record<string, unknown> | null> {
		const result = await this.db
			.prepare(`
          INSERT INTO user (
            name, 
            avatar_url, 
            email, 
            github_username,
            company,
            location,
            bio,
            twitter_username,
            site,
            created_at, 
            updated_at
          ) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          RETURNING *
        `)
			.bind(
				userData.name || null,
				userData.avatarUrl || null,
				userData.email,
				userData.username,
				userData.company || null,
				userData.location || null,
				userData.bio || null,
				userData.twitterUsername || null,
				userData.site || null,
			)
			.first();

		if (!result) {
			throw new AssistantError("Error creating user in the database");
		}

		return result;
	}

	public async createSession(
		sessionId: string,
		userId: number,
		expiresAt: Date,
	): Promise<void> {
		const result = await this.db
			.prepare(`
      INSERT INTO session (id, user_id, expires_at)
      VALUES (?, ?, ?)
    `)
			.bind(sessionId, userId, expiresAt.toISOString())
			.run();

		if (!result) {
			throw new AssistantError("Error creating session in the database");
		}
	}

	public async deleteSession(sessionId: string): Promise<void> {
		const result = await this.db
			.prepare(`
      DELETE FROM session
      WHERE id = ?
    `)
			.bind(sessionId)
			.run();

		if (!result) {
			throw new AssistantError("Error deleting session in the database");
		}
	}

	public async getEmbedding(
		id: string,
		type?: string,
	): Promise<Record<string, unknown> | null> {
		const query = type
			? "SELECT id, metadata, type, title, content FROM embedding WHERE id = ?1 AND type = ?2"
			: "SELECT id, metadata, type, title, content FROM embedding WHERE id = ?1";
		const stmt = type
			? await this.db.prepare(query).bind(id, type)
			: await this.db.prepare(query).bind(id);
		const record = await stmt.first();

		return record;
	}

	public async getEmbeddingIdByType(
		id: string,
		type: string,
	): Promise<Record<string, unknown> | null> {
		const record = await this.db
			.prepare("SELECT id FROM embedding WHERE id = ?1 AND type = ?2")
			.bind(id, type)
			.first();

		return record;
	}

	public async insertEmbedding(
		id: string,
		metadata: Record<string, unknown>,
		title: string,
		content: string,
		type: string,
	): Promise<void> {
		const database = await this.db
			.prepare(
				"INSERT INTO embedding (id, metadata, title, content, type) VALUES (?1, ?2, ?3, ?4, ?5)",
			)
			.bind(id, JSON.stringify(metadata), title, content, type);
		const result = await database.run();

		if (!result.success) {
			throw new AssistantError("Error storing embedding in the database");
		}
	}

	public async createConversation(
		conversationId: string,
		userId: number,
		title?: string,
		options: Record<string, unknown> = {},
	): Promise<Record<string, unknown> | null> {
		const result = await this.db
			.prepare(`
      INSERT INTO conversation (
        id, 
        user_id, 
        title, 
        created_at, 
        updated_at
      )
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
      RETURNING *
    `)
			.bind(conversationId, userId, title || null)
			.first();

		if (!result) {
			throw new AssistantError("Error creating conversation in the database");
		}

		return result;
	}

	public async getConversation(
		conversationId: string,
	): Promise<Record<string, unknown> | null> {
		const result = await this.db
			.prepare(`
      SELECT * FROM conversation WHERE id = ?
    `)
			.bind(conversationId)
			.first();

		return result;
	}

	public async getUserConversations(
		userId: number,
		limit = 25,
		page = 1,
		includeArchived = false,
	): Promise<{
		conversations: Record<string, unknown>[];
		totalPages: number;
		pageNumber: number;
		pageSize: number;
	}> {
		const offset = (page - 1) * limit;

		const countQuery = includeArchived
			? "SELECT COUNT(*) as total FROM conversation WHERE user_id = ?"
			: "SELECT COUNT(*) as total FROM conversation WHERE user_id = ? AND is_archived = 0";

		const countResult = await this.db.prepare(countQuery).bind(userId).first();

		const total = (countResult?.total as number) || 0;
		const totalPages = Math.ceil(total / limit);

		const listQuery = includeArchived
			? `
				SELECT c.*, 
				(SELECT GROUP_CONCAT(m.id) FROM message m WHERE m.conversation_id = c.id) as messages
				FROM conversation c
				WHERE c.user_id = ?
				ORDER BY c.updated_at DESC
				LIMIT ? OFFSET ?
			`
			: `
				SELECT c.*, 
				(SELECT GROUP_CONCAT(m.id) FROM message m WHERE m.conversation_id = c.id) as messages
				FROM conversation c
				WHERE c.user_id = ? AND c.is_archived = 0
				ORDER BY c.updated_at DESC
				LIMIT ? OFFSET ?
			`;

		const conversations = await this.db
			.prepare(listQuery)
			.bind(userId, limit, offset)
			.all();

		return {
			conversations: conversations.results as Record<string, unknown>[],
			totalPages,
			pageNumber: page,
			pageSize: limit,
		};
	}

	public async updateConversation(
		conversationId: string,
		updates: Record<string, unknown>,
	): Promise<D1Result<Record<string, unknown>> | null> {
		const allowedFields = [
			"title",
			"is_archived",
			"last_message_id",
			"last_message_at",
			"message_count",
		];
		const setClause = allowedFields
			.filter((field) => updates[field] !== undefined)
			.map((field) => `${field} = ?`)
			.join(", ");

		if (!setClause.length) {
			return null;
		}

		const values = allowedFields
			.filter((field) => updates[field] !== undefined)
			.map((field) => updates[field]);

		values.push(conversationId);

		const result = await this.db
			.prepare(`
      UPDATE conversation 
      SET ${setClause}, updated_at = datetime('now')
      WHERE id = ?
    `)
			.bind(...values)
			.run();

		if (!result.success) {
			throw new AssistantError("Error updating conversation in the database");
		}

		return result;
	}

	public async deleteConversation(conversationId: string): Promise<void> {
		await this.db
			.prepare("DELETE FROM message WHERE conversation_id = ?")
			.bind(conversationId)
			.run();

		const result = await this.db
			.prepare("DELETE FROM conversation WHERE id = ?")
			.bind(conversationId)
			.run();

		if (!result.success) {
			throw new AssistantError("Error deleting conversation from the database");
		}
	}

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

		const result = await this.db
			.prepare(`
      INSERT INTO message (
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
        created_at, 
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      RETURNING *
    `)
			.bind(
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
			)
			.first();

		if (!result) {
			throw new AssistantError("Error creating message in the database");
		}

		return result;
	}

	public async getMessage(
		messageId: string,
	): Promise<Record<string, unknown> | null> {
		const result = await this.db
			.prepare("SELECT * FROM message WHERE id = ?")
			.bind(messageId)
			.first();

		return result;
	}

	public async getConversationMessages(
		conversationId: string,
		limit = 50,
		after?: string,
	): Promise<Record<string, unknown>[]> {
		let query = `
      SELECT * FROM message 
      WHERE conversation_id = ?
    `;

		const params = [conversationId];

		if (after) {
			query += " AND id > ?";
			params.push(after);
		}

		query += " ORDER BY created_at ASC LIMIT ?";
		params.push(limit.toString());

		const result = await this.db
			.prepare(query)
			.bind(...params)
			.all();

		return result.results as Record<string, unknown>[];
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
		];
		const setClause = allowedFields
			.filter((field) => updates[field] !== undefined)
			.map((field) => {
				if (
					field === "tool_calls" ||
					field === "citations" ||
					field === "data"
				) {
					updates[field] = JSON.stringify(updates[field]);
				} else if (field === "content" && typeof updates[field] === "object") {
					updates[field] = JSON.stringify(updates[field]);
				}
				return `${field} = ?`;
			})
			.join(", ");

		if (!setClause.length) {
			return;
		}

		const values = allowedFields
			.filter((field) => updates[field] !== undefined)
			.map((field) => updates[field]);

		values.push(messageId);

		const result = await this.db
			.prepare(`
      UPDATE message 
      SET ${setClause}, updated_at = datetime('now')
      WHERE id = ?
    `)
			.bind(...values)
			.run();

		if (!result.success) {
			throw new AssistantError("Error updating message in the database");
		}
	}

	public async deleteMessage(messageId: string): Promise<void> {
		const result = await this.db
			.prepare("DELETE FROM message WHERE id = ?")
			.bind(messageId)
			.run();

		if (!result.success) {
			throw new AssistantError("Error deleting message from the database");
		}
	}

	public async getChildMessages(
		parentMessageId: string,
		limit = 50,
	): Promise<Record<string, unknown>[]> {
		const query = `
      SELECT * FROM message 
      WHERE parent_message_id = ?
      ORDER BY created_at ASC 
      LIMIT ?
    `;

		const result = await this.db
			.prepare(query)
			.bind(parentMessageId, limit.toString())
			.all();

		return result.results as Record<string, unknown>[];
	}

	public async updateConversationAfterMessage(
		conversationId: string,
		messageId: string,
	): Promise<void> {
		const result = await this.db
			.prepare(`
      UPDATE conversation 
      SET 
        last_message_id = ?,
        last_message_at = datetime('now'),
        message_count = message_count + 1,
        updated_at = datetime('now')
      WHERE id = ?
    `)
			.bind(messageId, conversationId)
			.run();

		if (!result.success) {
			throw new AssistantError("Error updating conversation after new message");
		}
	}

	public async searchConversations(
		userId: number,
		query: string,
		limit = 25,
		offset = 0,
	): Promise<Record<string, unknown>[]> {
		const searchQuery = `
      SELECT c.* 
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
      LIMIT ? OFFSET ?
    `;

		const searchTerm = `%${query}%`;

		const result = await this.db
			.prepare(searchQuery)
			.bind(userId, searchTerm, searchTerm, limit.toString(), offset.toString())
			.all();

		return result.results as Record<string, unknown>[];
	}

	public async searchMessages(
		userId: number,
		query: string,
		limit = 25,
		offset = 0,
	): Promise<Record<string, unknown>[]> {
		const searchQuery = `
      SELECT m.* 
      FROM message m
      JOIN conversation c ON m.conversation_id = c.id
      WHERE c.user_id = ?
      AND m.content LIKE ?
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `;

		const searchTerm = `%${query}%`;

		const result = await this.db
			.prepare(searchQuery)
			.bind(userId, searchTerm, limit.toString(), offset.toString())
			.all();

		return result.results as Record<string, unknown>[];
	}

	public async getMessageById(messageId: string): Promise<{
		message: Record<string, unknown>;
		conversation_id: string;
		user_id: number;
	} | null> {
		const result = await this.db
			.prepare(`
				SELECT m.*, c.id as conversation_id, c.user_id 
				FROM message m
				JOIN conversation c ON m.conversation_id = c.id
				WHERE m.id = ?
			`)
			.bind(messageId)
			.first();

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
