import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import {
  ActivityRepository,
  type ActivityRecord,
} from "~/modules/activity/infrastructure/ActivityRepository";
import {
  inboxNotificationSchema,
  type InboxNotification,
} from "~/modules/notifications/domain/inbox";

export class NotificationRepository extends BaseRepository {
  async create(
    userId: number,
    eventKey: string,
    input: Omit<InboxNotification, "readAt" | "dismissedAt" | "dispatchedAt">,
  ): Promise<string> {
    const data = inboxNotificationSchema.parse(input);
    const id = `notification:${await sha256Hex(`${userId}:${data.source}:${eventKey}`)}`;

    await new ActivityRepository(this.env).recordActivityOnce({
      id,
      createdByUserId: userId,
      conversationId: null,
      capabilityId: "notifications",
      groupId: data.source,
      kind: "notification",
      status: "queued",
      summary: data.title,
      data,
      createdAt: new Date().toISOString(),
    });

    return id;
  }

  async get(userId: number, id: string) {
    const row = await this.runQuery<ActivityRecord>(
      "SELECT * FROM activity_record WHERE id = ? AND created_by_user_id = ? AND project_id IS NULL AND capability_id = 'notifications' AND kind = 'notification'",
      [id, userId],
      true,
    );
    const parsed = inboxNotificationSchema.safeParse(safeParseJson(row?.data ?? "null"));

    return row && parsed.success
      ? { ...parsed.data, id: row.id, createdAt: row.created_at, status: row.status }
      : null;
  }

  async list(userId: number, options: { source?: string; pending?: boolean } = {}) {
    const rows = await this.runQuery<ActivityRecord>(
      `SELECT * FROM activity_record WHERE created_by_user_id = ? AND project_id IS NULL
       AND capability_id = 'notifications' AND kind = 'notification'
       AND status IN ('queued', 'succeeded') AND json_extract(data, '$.expiresAt') > ?
       AND json_extract(data, '$.dismissedAt') IS NULL
       ${options.source ? "AND group_id = ?" : ""}
       ${options.pending ? "AND json_extract(data, '$.dispatchedAt') IS NULL" : "AND status = 'succeeded'"}
       ORDER BY created_at DESC LIMIT 100`,
      [userId, new Date().toISOString(), ...(options.source ? [options.source] : [])],
    );

    return rows.flatMap((row) => {
      const parsed = inboxNotificationSchema.safeParse(safeParseJson(row.data));

      return parsed.success ? [{ ...parsed.data, id: row.id, createdAt: row.created_at }] : [];
    });
  }

  async update(
    userId: number,
    id: string,
    input: {
      status?: "succeeded" | "cancelled";
      payload?: Record<string, unknown>;
      dispatchedAt?: string;
    },
  ) {
    await this.executeRun(
      `UPDATE activity_record SET status = COALESCE(?, status), data = json_patch(data, json(?)), updated_at = ?
       WHERE id = ? AND created_by_user_id = ? AND project_id IS NULL AND capability_id = 'notifications' AND kind = 'notification' AND status IN ('queued', 'succeeded')`,
      [
        input.status ?? null,
        JSON.stringify({
          ...(input.payload ? { payload: input.payload } : {}),
          ...(input.dispatchedAt ? { dispatchedAt: input.dispatchedAt } : {}),
        }),
        new Date().toISOString(),
        id,
        userId,
      ],
    );
  }

  async cancelSource(userId: number, source: string): Promise<void> {
    await this.executeRun(
      "UPDATE activity_record SET status = 'cancelled', updated_at = ? WHERE created_by_user_id = ? AND project_id IS NULL AND capability_id = 'notifications' AND kind = 'notification' AND group_id = ? AND status IN ('queued', 'succeeded')",
      [new Date().toISOString(), userId, source],
    );
  }

  async updateReceipts(
    userId: number,
    ids: readonly string[],
    action: "read" | "dismiss",
  ): Promise<number> {
    const notificationIds = [...new Set(ids.filter((id) => id.startsWith("notification:")))];

    if (notificationIds.length === 0) {
      return 0;
    }

    const now = new Date().toISOString();
    const result = await this.executeRun(
      `UPDATE activity_record SET data = json_set(data, ?, ?), updated_at = ?
       WHERE id IN (SELECT value FROM json_each(?)) AND created_by_user_id = ? AND project_id IS NULL AND capability_id = 'notifications' AND kind = 'notification' AND status = 'succeeded'`,
      [
        action === "read" ? "$.readAt" : "$.dismissedAt",
        now,
        now,
        JSON.stringify(notificationIds),
        userId,
      ],
    );

    return result.meta.changes ?? 0;
  }
}
