import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { ChannelBindingRow, ChannelSenderRow } from "~/infrastructure/database/schema";

import { CHANNEL_ADMIN_GUARD, CHANNEL_MEMBER_GUARD } from "./channel-access";

export class ChannelSenderRepository extends BaseRepository {
  async issueChallenge(
    bindingId: string,
    userId: number,
    tokenHash: string,
    expiresAt: string,
  ): Promise<boolean> {
    const result = await this.executeRun(
      `INSERT INTO channel_pairing_challenge (token_hash, binding_id, user_id, expires_at)
      SELECT ?, id, ?, ? FROM channel_binding WHERE id = ? AND enabled = 1 AND (${CHANNEL_MEMBER_GUARD})
      ON CONFLICT(binding_id, user_id) DO UPDATE SET token_hash = excluded.token_hash, expires_at = excluded.expires_at`,
      [tokenHash, userId, expiresAt, bindingId, userId, userId],
    );

    return result.meta.changes === 1;
  }

  async consumeChallenge(
    bindingId: string,
    senderId: string,
    isDirect: boolean,
    tokenHash: string,
  ): Promise<ChannelSenderRow | null> {
    const result = await this.env.DB.batch([
      this.env.DB.prepare(`INSERT INTO channel_sender (id, binding_id, sender_id, user_id)
        SELECT ?, channel_binding.id, ?, channel_pairing_challenge.user_id FROM channel_pairing_challenge
        JOIN channel_binding ON channel_binding.id = channel_pairing_challenge.binding_id
        WHERE token_hash = ? AND channel_binding.id = ? AND enabled = 1 AND julianday(expires_at) > julianday('now')
          AND ? = 1 AND ((channel_binding.scope_type = 'personal' AND channel_binding.scope_id = CAST(channel_pairing_challenge.user_id AS TEXT))
            OR (channel_binding.scope_type = 'project' AND EXISTS (SELECT 1 FROM project JOIN workspace_member
              ON workspace_member.workspace_id = project.workspace_id WHERE project.id = channel_binding.scope_id
              AND workspace_member.user_id = channel_pairing_challenge.user_id)))
        ON CONFLICT(binding_id, sender_id) DO UPDATE SET revision = channel_sender.revision + 1, revoked_at = NULL
          WHERE channel_sender.user_id = excluded.user_id`).bind(
        generateId(),
        senderId,
        tokenHash,
        bindingId,
        isDirect ? 1 : 0,
      ),
      this.env.DB.prepare(
        "DELETE FROM channel_pairing_challenge WHERE token_hash = ? AND changes() = 1",
      ).bind(tokenHash),
    ]);

    return result[0]?.meta.changes === 1 ? this.getBySender(bindingId, senderId) : null;
  }

  async challengeBinding(tokenHash: string): Promise<ChannelBindingRow | null> {
    return this.runQuery<ChannelBindingRow>(
      `SELECT channel_binding.* FROM channel_binding JOIN channel_pairing_challenge
      ON channel_pairing_challenge.binding_id = channel_binding.id WHERE token_hash = ? AND enabled = 1
      AND julianday(expires_at) > julianday('now')`,
      [tokenHash],
      true,
    );
  }

  async discardChallenge(tokenHash: string): Promise<void> {
    await this.executeRun("DELETE FROM channel_pairing_challenge WHERE token_hash = ?", [
      tokenHash,
    ]);
  }

  async getBySender(bindingId: string, senderId: string): Promise<ChannelSenderRow | null> {
    return this.runQuery<ChannelSenderRow>(
      "SELECT * FROM channel_sender WHERE binding_id = ? AND sender_id = ?",
      [bindingId, senderId],
      true,
    );
  }

  async eligibleSender(
    bindingId: string,
    senderId: string,
    isDirect: boolean,
  ): Promise<ChannelSenderRow | null> {
    return this.runQuery<ChannelSenderRow>(
      `SELECT channel_sender.* FROM channel_sender JOIN channel_binding ON channel_binding.id = binding_id
      WHERE binding_id = ? AND sender_id = ? AND revoked_at IS NULL AND enabled = 1
        AND ((channel_binding.scope_type = 'personal' AND ? = 1 AND channel_binding.scope_id = CAST(channel_sender.user_id AS TEXT))
          OR (channel_binding.scope_type = 'project' AND EXISTS (SELECT 1 FROM project JOIN workspace_member
            ON workspace_member.workspace_id = project.workspace_id WHERE project.id = channel_binding.scope_id AND workspace_member.user_id = channel_sender.user_id)))`,
      [bindingId, senderId, isDirect ? 1 : 0],
      true,
    );
  }

  async validateMapping(
    bindingId: string,
    mappingId: string,
    revision: number,
    userId: number,
  ): Promise<ChannelSenderRow | null> {
    return this.runQuery<ChannelSenderRow>(
      `SELECT channel_sender.* FROM channel_sender JOIN channel_binding ON channel_binding.id = binding_id
      WHERE binding_id = ? AND channel_sender.id = ? AND revision = ? AND user_id = ? AND revoked_at IS NULL AND enabled = 1
      AND (${CHANNEL_MEMBER_GUARD})`,
      [bindingId, mappingId, revision, userId, userId, userId],
      true,
    );
  }

  async list(bindingId: string, userId: number, canManage: boolean): Promise<ChannelSenderRow[]> {
    return this.runQuery<ChannelSenderRow>(
      `SELECT channel_sender.* FROM channel_sender JOIN channel_binding ON channel_binding.id = binding_id
      WHERE binding_id = ? AND (${CHANNEL_MEMBER_GUARD}) AND (channel_sender.user_id = ? OR (? = 1 AND (${CHANNEL_ADMIN_GUARD}))) ORDER BY created_at`,
      [bindingId, userId, userId, userId, canManage ? 1 : 0, userId, userId],
    );
  }

  async revoke(
    bindingId: string,
    mappingId: string,
    revision: number,
    userId: number,
  ): Promise<boolean> {
    const result = await this.executeRun(
      `UPDATE channel_sender SET revoked_at = CURRENT_TIMESTAMP, revision = revision + 1
      WHERE binding_id = ? AND id = ? AND revision = ? AND revoked_at IS NULL AND EXISTS
        (SELECT 1 FROM channel_binding WHERE channel_binding.id = channel_sender.binding_id AND (${CHANNEL_MEMBER_GUARD})
          AND (channel_sender.user_id = ? OR (${CHANNEL_ADMIN_GUARD})))`,
      [bindingId, mappingId, revision, userId, userId, userId, userId, userId],
    );

    return result.meta.changes === 1;
  }
}
