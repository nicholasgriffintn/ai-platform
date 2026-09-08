import { conversationHandleSchema, type ConversationHandle } from "@ngriffin_uk/polychat-schemas";

import type { ConversationHandleRow } from "~/lib/database/schema";

import { BaseRepository } from "./BaseRepository";

function formatHandle(row: ConversationHandleRow): ConversationHandle {
  return conversationHandleSchema.parse({
    id: row.id,
    conversationId: row.conversation_id,
    grantedTo: { kind: "delegation", delegationId: row.delegation_id },
    grantedBy: row.granted_by,
    grantedAt: row.granted_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  });
}

export class ConversationHandleRepository extends BaseRepository {
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

    return formatHandle(row);
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

    return row ? formatHandle(row) : null;
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

    return row ? formatHandle(row) : null;
  }
}
