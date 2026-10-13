import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";

export interface SavedItemRow {
  user_id: number;
  conversation_id: string;
  message_id: string;
  note: string | null;
  saved_at: string;
  conversation_title: string | null;
  message_content: unknown;
}

export interface ListSavedItemsOptions {
  limit: number;
  after?: string;
  conversationId?: string;
}

const SELECT_SAVED_ITEMS = `SELECT s.user_id, s.saved_conversation_id AS conversation_id, s.message_id, s.note, s.saved_at,
    c.title AS conversation_title, m.content AS message_content
  FROM user_resource_state s
  LEFT JOIN conversation c ON c.id = s.saved_conversation_id
  LEFT JOIN message m ON m.id = s.message_id AND m.conversation_id = s.saved_conversation_id`;

export class SavedItemRepository extends BaseRepository {
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

  public async find(userId: number, messageId: string): Promise<SavedItemRow | null> {
    return this.runQuery<SavedItemRow>(
      `${SELECT_SAVED_ITEMS}
       WHERE s.resource_type = 'message' AND s.user_id = ? AND s.message_id = ?`,
      [userId, messageId],
      true,
    );
  }

  public async list(userId: number, options: ListSavedItemsOptions): Promise<SavedItemRow[]> {
    const filters = ["s.resource_type = 'message'", "s.user_id = ?"];
    const values: unknown[] = [userId];

    if (options.conversationId) {
      filters.push("s.saved_conversation_id = ?");
      values.push(options.conversationId);
    }

    if (options.after) {
      filters.push(`(s.saved_at, s.message_id) < (
        SELECT cursor.saved_at, cursor.message_id
        FROM user_resource_state cursor
        WHERE cursor.resource_type = 'message' AND cursor.user_id = ? AND cursor.message_id = ?
      )`);
      values.push(userId, options.after);
    }

    return this.runQuery<SavedItemRow>(
      `${SELECT_SAVED_ITEMS}
       WHERE ${filters.join(" AND ")}
       ORDER BY s.saved_at DESC, s.message_id DESC
       LIMIT ?`,
      [...values, options.limit + 1],
    );
  }
}
