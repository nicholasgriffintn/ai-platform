import { BaseRepository } from "./BaseRepository";

export class ConversationRepository extends BaseRepository {
  public async createConversation(
    conversationId: string,
    userId: number,
    title?: string,
    options: Record<string, unknown> = {},
  ): Promise<Record<string, unknown> | null> {
    const parentConversationId = options.parent_conversation_id as
      | string
      | undefined;
    const parentMessageId = options.parent_message_id as string | undefined;

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

  public async getConversation(
    conversationId: string,
  ): Promise<Record<string, unknown> | null> {
    const result = this.runQuery<Record<string, unknown>>(
      "SELECT * FROM conversation WHERE id = ?",
      [conversationId],
      true,
    );
    return result;
  }

  public async getConversationByShareId(
    shareId: string,
  ): Promise<Record<string, unknown> | null> {
    const result = this.runQuery<Record<string, unknown>>(
      "SELECT * FROM conversation WHERE share_id = ?",
      [shareId],
      true,
    );
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

    const countResult = (await this.runQuery<{ total: number }>(
      countQuery,
      [userId],
      true,
    )) as { total: number } | null;

    const total = countResult?.total || 0;
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

    const conversations = (await this.runQuery<Record<string, unknown>>(
      listQuery,
      [userId, limit, offset],
    )) as Record<string, unknown>[];

    return {
      conversations,
      totalPages,
      pageNumber: page,
      pageSize: limit,
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

    return this.executeRun(
      `UPDATE conversation 
       SET ${setClause}, updated_at = datetime('now')
       WHERE id = ?`,
      values,
    );
  }

  public async deleteConversation(conversationId: string): Promise<void> {
    await this.executeRun("DELETE FROM message WHERE conversation_id = ?", [
      conversationId,
    ]);

    await this.executeRun("DELETE FROM conversation WHERE id = ?", [
      conversationId,
    ]);
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
