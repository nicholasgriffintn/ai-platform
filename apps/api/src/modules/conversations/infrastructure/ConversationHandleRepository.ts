import type { ConversationHandle } from "@ngriffin_uk/polychat-schemas";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { ConversationHandleRow } from "~/infrastructure/database/schema";
import { formatConversationHandle } from "~/modules/conversations/application/conversation-handles";
import type { IEnv } from "~/types";

export class ConversationHandleRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async listForUser(userId: number): Promise<ConversationHandle[]> {
    const rows = await this.runQuery<ConversationHandleRow>(
      `SELECT h.*, h.created_at AS granted_at FROM resource_grant h
       JOIN conversation c ON c.id = h.conversation_id
       WHERE h.kind = 'conversation' AND c.user_id = ? AND h.revoked_at IS NULL
       ORDER BY h.created_at DESC, h.id DESC`,
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
      `INSERT INTO resource_grant
        (kind, id, conversation_id, delegation_id, granted_by, created_at, expires_at)
       VALUES ('conversation', ?, ?, ?, 'spawn', ?, ?)
       RETURNING *, created_at AS granted_at`,
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
      `SELECT *, created_at AS granted_at FROM resource_grant
       WHERE kind = 'conversation' AND id = ? AND delegation_id = ? AND revoked_at IS NULL
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
      `UPDATE resource_grant SET revoked_at = ?
       WHERE kind = 'conversation' AND id = ? AND delegation_id = ? AND revoked_at IS NULL
       RETURNING *, created_at AS granted_at`,
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
      `UPDATE resource_grant
       SET revoked_at = ?
       WHERE kind = 'conversation' AND id = ? AND revoked_at IS NULL
         AND EXISTS (
           SELECT 1 FROM conversation
           WHERE conversation.id = resource_grant.conversation_id
             AND conversation.user_id = ?
         )
       RETURNING *, created_at AS granted_at`,
      [revokedAt, id, userId],
      true,
    );

    return row ? formatConversationHandle(row) : null;
  }
}
