import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { BaseRepository } from "./BaseRepository";

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
      `INSERT INTO message_user_state (id, user_id, conversation_id, message_id, note)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (user_id, message_id)
       DO UPDATE SET note = excluded.note, saved_at = CURRENT_TIMESTAMP`,
      [generateId(), input.userId, input.conversationId, input.messageId, input.note ?? null],
    );
  }

  public async unsave(userId: number, messageId: string): Promise<void> {
    await this.executeRun("DELETE FROM message_user_state WHERE user_id = ? AND message_id = ?", [
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
      `SELECT s.*, c.title AS conversation_title, m.content AS message_content
       FROM message_user_state s
       LEFT JOIN conversation c ON c.id = s.conversation_id
       LEFT JOIN message m ON m.id = s.message_id
       WHERE s.user_id = ?
       ORDER BY s.saved_at DESC
       LIMIT ?`,
      [userId, limit],
    );
  }

  public async listSavedMessageIds(userId: number, conversationId: string): Promise<string[]> {
    const rows = await this.runQuery<{ message_id: string }>(
      "SELECT message_id FROM message_user_state WHERE user_id = ? AND conversation_id = ?",
      [userId, conversationId],
    );

    return rows.map((row) => row.message_id);
  }
}
