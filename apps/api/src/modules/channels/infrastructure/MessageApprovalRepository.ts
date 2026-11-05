import { generatePrefixedId } from "@ngriffin_uk/polychat-utility-core";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { MessageApprovalRow } from "~/infrastructure/database/schema";

export interface CreateMessageApproval {
  userId: number;
  runId: string;
  runAttempt: number;
  conversationId: string;
  interactionId: string;
  toolName: string;
  connectorApprovalId: string | null;
  argumentDigest: string;
  effectClass: string;
  channel: string;
  senderKey: string;
  codeHash: string;
  expiresAt: string;
}

export class MessageApprovalRepository extends BaseRepository {
  async create(input: CreateMessageApproval): Promise<MessageApprovalRow | null> {
    return this.runQuery<MessageApprovalRow>(
      `INSERT INTO message_approval (id, user_id, run_id, run_attempt, conversation_id, interaction_id,
         tool_name, connector_approval_id, argument_digest, effect_class, channel, sender_key, code_hash, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(run_id, run_attempt, interaction_id, channel, sender_key) DO NOTHING
       RETURNING *`,
      [
        generatePrefixedId("mapr_"),
        input.userId,
        input.runId,
        input.runAttempt,
        input.conversationId,
        input.interactionId,
        input.toolName,
        input.connectorApprovalId,
        input.argumentDigest,
        input.effectClass,
        input.channel,
        input.senderKey,
        input.codeHash,
        input.expiresAt,
      ],
      true,
    );
  }

  async getByCode(userId: number, codeHash: string): Promise<MessageApprovalRow | null> {
    return this.runQuery<MessageApprovalRow>(
      "SELECT * FROM message_approval WHERE user_id = ? AND code_hash = ?",
      [userId, codeHash],
      true,
    );
  }

  async claim(input: {
    id: string;
    userId: number;
    channel: string;
    senderKey: string;
    argumentDigest: string;
    resolution: "approved" | "rejected";
    messageId: string;
    now: string;
  }): Promise<MessageApprovalRow | null> {
    return this.runQuery<MessageApprovalRow>(
      `UPDATE message_approval
       SET state = ?, resolved_message_id = ?, resolved_at = ?
       WHERE id = ? AND user_id = ? AND state = 'pending' AND expires_at > ?
         AND channel = ? AND sender_key = ? AND argument_digest = ?
         AND EXISTS (
           SELECT 1 FROM conversation_run run
           WHERE run.id = message_approval.run_id
             AND run.attempt = message_approval.run_attempt
             AND run.conversation_id = message_approval.conversation_id
             AND run.initiator_user_id = message_approval.user_id
             AND run.status = 'awaiting_approval'
             AND run.interaction_kind = 'approval'
         )
       RETURNING *`,
      [
        input.resolution,
        input.messageId,
        input.now,
        input.id,
        input.userId,
        input.now,
        input.channel,
        input.senderKey,
        input.argumentDigest,
      ],
      true,
    );
  }
}
