import type { InboundChannelId } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { ChannelBindingRow } from "~/infrastructure/database/schema";

import { CHANNEL_ADMIN_GUARD, CHANNEL_MEMBER_GUARD } from "./channel-access";

export interface CreateChannelBindingRecord {
  channel: InboundChannelId;
  scopeType: "personal" | "project";
  scopeId: string;
  externalId: string;
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
          interaction_mode, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ],
    );

    return this.getById(id);
  }

  public async getById(id: string): Promise<ChannelBindingRow | null> {
    return this.runQuery<ChannelBindingRow>(
      "SELECT * FROM channel_binding WHERE id = ?",
      [id],
      true,
    );
  }

  public async getByExternalId(
    channel: string,
    externalId: string,
  ): Promise<ChannelBindingRow | null> {
    return this.runQuery<ChannelBindingRow>(
      "SELECT * FROM channel_binding WHERE channel = ? AND external_id = ? AND enabled = 1",
      [channel, externalId],
      true,
    );
  }

  public async listForUser(userId: number): Promise<ChannelBindingRow[]> {
    return this.runQuery<ChannelBindingRow>(
      `SELECT * FROM channel_binding WHERE ${CHANNEL_MEMBER_GUARD} ORDER BY created_at DESC`,
      [userId, userId],
    );
  }

  public async delete(id: string, userId: number): Promise<void> {
    await this.executeRun(`DELETE FROM channel_binding WHERE id = ? AND (${CHANNEL_ADMIN_GUARD})`, [
      id,
      userId,
      userId,
    ]);
  }
}
