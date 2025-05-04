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
         app,
         parts,
         created_at, 
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
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
      "app",
      "mode",
      "platform",
      "model",
      "name",
      "timestamp",
      "usage",
      "parts",
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

    await this.executeRun(
      `UPDATE message 
       SET ${setClause}, updated_at = datetime('now')
       WHERE id = ?`,
      values,
    );
  }

  public async deleteMessage(messageId: string): Promise<void> {
    await this.executeRun("DELETE FROM message WHERE id = ?", [messageId]);
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
