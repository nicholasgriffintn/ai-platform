import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { ChannelBindingRow } from "~/infrastructure/database/schema";
import { toChannelBindingRow } from "~/modules/channels/domain/bindings";

export interface CreateChannelBindingRecord {
  channel: "sms" | "slack" | "telegram";
  scopeType: "personal" | "project";
  scopeId: string;
  externalId: string;
  workspaceId: string;
  allowedSenderIds: string[];
  replyMode: "mentions" | "all";
  label?: string | null;
  teammateId?: string | null;
  interactionMode: "direct" | "automated";
  createdByUserId: number;
}

export class ChannelBindingRepository extends BaseRepository {
  public async create(record: CreateChannelBindingRecord): Promise<ChannelBindingRow | null> {
    const id = generateId();

    await this.executeRun(
      `INSERT INTO channel_binding
         (id, channel, scope_type, scope_id, external_id, label, teammate_id,
          interaction_mode, created_by, workspace_id, allowed_sender_ids, reply_mode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        record.channel,
        record.scopeType,
        record.scopeId,
        record.externalId,
        record.label ?? null,
        record.teammateId ?? null,
        record.interactionMode,
        record.createdByUserId,
        record.workspaceId,
        JSON.stringify(record.allowedSenderIds),
        record.replyMode,
      ],
    );

    return this.getById(id);
  }

  public async getById(id: string): Promise<ChannelBindingRow | null> {
    const row = await this.runQuery<ChannelBindingRow>(
      "SELECT * FROM channel_binding WHERE id = ?",
      [id],
      true,
    );

    return row ? toChannelBindingRow(row) : null;
  }

  public async findByExternalId(
    channel: string,
    externalId: string,
    workspaceId: string,
  ): Promise<ChannelBindingRow | null> {
    const row = await this.runQuery<ChannelBindingRow>(
      "SELECT * FROM channel_binding WHERE channel = ? AND external_id = ? AND workspace_id IS ?",
      [channel, externalId, workspaceId],
      true,
    );

    return row ? toChannelBindingRow(row) : null;
  }

  public async listForUser(userId: number): Promise<ChannelBindingRow[]> {
    const rows = await this.runQuery<ChannelBindingRow>(
      "SELECT * FROM channel_binding WHERE created_by = ? ORDER BY created_at DESC",
      [userId],
    );

    return rows.map(toChannelBindingRow);
  }

  public async update(params: {
    id: string;
    userId: number;
    expectedRevision: number;
    allowedSenderIds: string[];
    replyMode: "mentions" | "all";
    enabled: boolean;
  }): Promise<ChannelBindingRow | null> {
    const row = await this.runQuery<ChannelBindingRow>(
      `UPDATE channel_binding SET allowed_sender_ids = ?, reply_mode = ?, enabled = ?, revision = revision + 1
       WHERE id = ? AND created_by = ? AND revision = ? RETURNING *`,
      [
        JSON.stringify(params.allowedSenderIds),
        params.replyMode,
        Number(params.enabled),
        params.id,
        params.userId,
        params.expectedRevision,
      ],
      true,
    );

    return row ? toChannelBindingRow(row) : null;
  }

  public async delete(id: string, userId: number): Promise<void> {
    await this.executeRun("DELETE FROM channel_binding WHERE id = ? AND created_by = ?", [
      id,
      userId,
    ]);
  }
}
