import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";

export interface SavedMessageRow {
  id: string;
  user_id: number;
  conversation_id: string;
  message_id: string;
  note: string | null;
  saved_at: string;
  conversation_title: string | null;
  message_content: unknown;
}

export class SavedMessageRepository extends BaseRepository {
  public async save(input: {
    userId: number;
    conversationId: string;
    messageId: string;
    note?: string | null;
  }): Promise<void> {
    await this.executeRun(
      `INSERT INTO user_resource_state (resource_type, id, user_id, saved_conversation_id, message_id, note)
       VALUES ('message', ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, message_id) WHERE message_id IS NOT NULL
       DO UPDATE SET note = excluded.note, saved_at = CURRENT_TIMESTAMP`,
      [generateId(), input.userId, input.conversationId, input.messageId, input.note ?? null],
    );
  }

  public async belongsToConversation(messageId: string, conversationId: string): Promise<boolean> {
    const rows = await this.runQuery<{ id: string }>(
      "SELECT id FROM message WHERE id = ? AND conversation_id = ? LIMIT 1",
      [messageId, conversationId],
    );

    return rows.length > 0;
  }

  public async unsave(userId: number, messageId: string): Promise<void> {
    await this.executeRun("DELETE FROM user_resource_state WHERE user_id = ? AND message_id = ?", [
      userId,
      messageId,
    ]);
  }

  public async list(userId: number, limit: number): Promise<SavedMessageRow[]> {
    if (limit <= 0) {
      throw new AssistantError(
        "A saved message limit must be positive",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    return this.runQuery<SavedMessageRow>(
      `SELECT s.*, s.saved_conversation_id AS conversation_id, c.title AS conversation_title, m.content AS message_content
       FROM user_resource_state s
       LEFT JOIN conversation c ON c.id = s.saved_conversation_id
       LEFT JOIN message m ON m.id = s.message_id AND m.conversation_id = s.saved_conversation_id
       WHERE s.resource_type = 'message' AND s.user_id = ?
       ORDER BY s.saved_at DESC
       LIMIT ?`,
      [userId, limit],
    );
  }

  public async listSavedMessageIds(userId: number, conversationId: string): Promise<string[]> {
    const rows = await this.runQuery<{ message_id: string }>(
      "SELECT message_id FROM user_resource_state WHERE resource_type = 'message' AND user_id = ? AND saved_conversation_id = ?",
      [userId, conversationId],
    );

    return rows.map((row) => row.message_id);
  }
}
