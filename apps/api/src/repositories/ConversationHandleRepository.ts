import type { ConversationHandle } from "@ngriffin_uk/polychat-schemas";

import type { ConversationHandleRow } from "~/lib/database/schema";
import type { IEnv } from "~/types";
import { formatConversationHandle } from "~/utils/conversation-handles";

import { BaseRepository } from "./BaseRepository";

export class ConversationHandleRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async listForUser(userId: number): Promise<ConversationHandle[]> {
    const rows = await this.runQuery<ConversationHandleRow>(
      `SELECT h.* FROM conversation_handle h
       JOIN conversation c ON c.id = h.conversation_id
       WHERE c.user_id = ? AND h.revoked_at IS NULL
       ORDER BY h.granted_at DESC, h.id DESC`,
      [userId],
    );

    return rows.map(formatConversationHandle);
  }

  async createSpawnHandle(input: {
    id: string;
    conversationId: string;
    delegationId: string;
    grantedAt: string;
    expiresAt: string | null;
  }): Promise<ConversationHandle> {
    const row = await this.runQuery<ConversationHandleRow>(
      `INSERT INTO conversation_handle
        (id, conversation_id, delegation_id, granted_by, granted_at, expires_at)
       VALUES (?, ?, ?, 'spawn', ?, ?)
       RETURNING *`,
      [input.id, input.conversationId, input.delegationId, input.grantedAt, input.expiresAt],
      true,
    );

    if (!row) {
      throw new Error("Failed to create conversation handle");
    }

    return formatConversationHandle(row);
  }

  async getUsableHandle(
    id: string,
    delegationId: string,
    now: string,
  ): Promise<ConversationHandle | null> {
    const row = await this.runQuery<ConversationHandleRow>(
      `SELECT * FROM conversation_handle
       WHERE id = ? AND delegation_id = ? AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > ?)`,
      [id, delegationId, now],
      true,
    );

    return row ? formatConversationHandle(row) : null;
  }

  async revoke(
    id: string,
    delegationId: string,
    revokedAt: string,
  ): Promise<ConversationHandle | null> {
    const row = await this.runQuery<ConversationHandleRow>(
      `UPDATE conversation_handle SET revoked_at = ?
       WHERE id = ? AND delegation_id = ? AND revoked_at IS NULL
       RETURNING *`,
      [revokedAt, id, delegationId],
      true,
    );

    return row ? formatConversationHandle(row) : null;
  }

  async revokeForUser(
    id: string,
    userId: number,
    revokedAt: string,
  ): Promise<ConversationHandle | null> {
    const row = await this.runQuery<ConversationHandleRow>(
      `UPDATE conversation_handle
       SET revoked_at = ?
       WHERE id = ? AND revoked_at IS NULL
         AND EXISTS (
           SELECT 1 FROM conversation
           WHERE conversation.id = conversation_handle.conversation_id
             AND conversation.user_id = ?
         )
       RETURNING *`,
      [revokedAt, id, userId],
      true,
    );

    return row ? formatConversationHandle(row) : null;
  }
}
