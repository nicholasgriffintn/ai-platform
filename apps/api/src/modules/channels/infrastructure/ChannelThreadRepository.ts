import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { ChannelThreadRow } from "~/infrastructure/database/schema";
import { toChannelThreadRow } from "~/modules/channels/domain/bindings";

export class ChannelThreadRepository extends BaseRepository {
  async get(bindingId: string, threadId: string): Promise<ChannelThreadRow | null> {
    const row = await this.runQuery<ChannelThreadRow>(
      "SELECT * FROM channel_thread WHERE binding_id = ? AND thread_id = ?",
      [bindingId, threadId],
      true,
    );

    return row ? toChannelThreadRow(row) : null;
  }

  async admit(params: {
    bindingId: string;
    bindingRevision: number;
    threadId: string;
    messageOrder: string;
    activate: boolean;
  }): Promise<ChannelThreadRow | null> {
    const row = await this.runQuery<ChannelThreadRow>(
      `INSERT INTO channel_thread (binding_id, thread_id)
       SELECT ?, ? WHERE EXISTS (SELECT 1 FROM channel_binding WHERE id = ? AND enabled = 1 AND revision = ?)
       AND (? = 1 OR EXISTS (SELECT 1 FROM channel_thread WHERE binding_id = ? AND thread_id = ? AND muted = 0))
       ON CONFLICT (binding_id, thread_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
       WHERE channel_thread.muted = 0 AND channel_thread.last_control_order < ?
       RETURNING *`,
      [
        params.bindingId,
        params.threadId,
        params.bindingId,
        params.bindingRevision,
        Number(params.activate),
        params.bindingId,
        params.threadId,
        params.messageOrder,
      ],
      true,
    );

    return row ? toChannelThreadRow(row) : null;
  }

  async control(params: {
    bindingId: string;
    bindingRevision: number;
    threadId: string;
    messageOrder: string;
    action: "mute" | "resume" | "stop";
  }): Promise<ChannelThreadRow | null> {
    const row = await this.runQuery<ChannelThreadRow>(
      `INSERT INTO channel_thread (binding_id, thread_id, muted, last_control_order)
       SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM channel_binding WHERE id = ? AND enabled = 1 AND revision = ?)
       ON CONFLICT (binding_id, thread_id) DO UPDATE SET
         revision = channel_thread.revision + 1,
         muted = CASE WHEN ? = 'stop' THEN channel_thread.muted ELSE excluded.muted END,
         last_control_order = excluded.last_control_order,
         updated_at = CURRENT_TIMESTAMP
       WHERE channel_thread.last_control_order < excluded.last_control_order
       RETURNING *`,
      [
        params.bindingId,
        params.threadId,
        Number(params.action === "mute"),
        params.messageOrder,
        params.bindingId,
        params.bindingRevision,
        params.action,
      ],
      true,
    );

    return row ? toChannelThreadRow(row) : null;
  }
}
