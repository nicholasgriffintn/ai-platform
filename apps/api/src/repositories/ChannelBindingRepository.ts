import type { ChannelBindingRow } from "~/lib/database/schema";
import { generateId } from "~/utils/id";

import { BaseRepository } from "./BaseRepository";

export interface CreateChannelBindingRecord {
  channel: "sms" | "slack" | "telegram";
  scopeType: "personal" | "project";
  scopeId: string;
  externalId: string;
  label?: string | null;
  teammateId?: string | null;
  createdByUserId: number;
}

export class ChannelBindingRepository extends BaseRepository {
  public async create(record: CreateChannelBindingRecord): Promise<ChannelBindingRow | null> {
    const id = generateId();

    await this.executeRun(
      `INSERT INTO channel_binding
         (id, channel, scope_type, scope_id, external_id, label, teammate_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        record.channel,
        record.scopeType,
        record.scopeId,
        record.externalId,
        record.label ?? null,
        record.teammateId ?? null,
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
      "SELECT * FROM channel_binding WHERE created_by = ? ORDER BY created_at DESC",
      [userId],
    );
  }

  public async delete(id: string, userId: number): Promise<void> {
    await this.executeRun("DELETE FROM channel_binding WHERE id = ? AND created_by = ?", [
      id,
      userId,
    ]);
  }
}
