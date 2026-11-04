import { DISCOVER_CAPABILITY_ID, DISCOVER_SEEN_KIND } from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { ActivityRepository } from "~/modules/activity/infrastructure/ActivityRepository";

const DISCOVER_EXPOSURE_DAYS = 7;
const discoverSeenDataSchema = z.object({
  itemId: z.string(),
  revision: z.number().int().positive(),
  topicKey: z.string().optional(),
});

export interface DiscoverExposure {
  seen: Map<string, number>;
  topics: Map<string, number>;
  since: number;
}

export class DiscoverSeenRepository extends BaseRepository {
  async list(userId: number): Promise<Map<string, number>> {
    return (await this.exposure(userId)).seen;
  }

  async exposure(userId: number): Promise<DiscoverExposure> {
    const since = Date.now() - DISCOVER_EXPOSURE_DAYS * 24 * 60 * 60 * 1000;
    const rows = await this.runQuery<{ data: string }>(
      `SELECT data FROM activity_record WHERE created_by_user_id = ? AND project_id IS NULL
       AND capability_id = ? AND kind = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 1000`,
      [userId, DISCOVER_CAPABILITY_ID, DISCOVER_SEEN_KIND, new Date(since).toISOString()],
    );
    const seen = new Map<string, number>();
    const topics = new Map<string, number>();

    for (const row of rows) {
      const parsed = discoverSeenDataSchema.safeParse(safeParseJson(row.data));

      if (parsed.success) {
        seen.set(
          parsed.data.itemId,
          Math.max(seen.get(parsed.data.itemId) ?? 0, parsed.data.revision),
        );

        if (parsed.data.topicKey) {
          topics.set(parsed.data.topicKey, (topics.get(parsed.data.topicKey) ?? 0) + 1);
        }
      }
    }

    return { seen, topics, since };
  }

  async mark(
    userId: number,
    itemId: string,
    revision: number,
    topicKey: string | null,
  ): Promise<void> {
    await new ActivityRepository(this.env).recordActivityOnce({
      id: `discover_seen_${userId}_${itemId}_${revision}`,
      createdByUserId: userId,
      conversationId: null,
      capabilityId: DISCOVER_CAPABILITY_ID,
      groupId: `${itemId}:${revision}`,
      kind: DISCOVER_SEEN_KIND,
      status: "succeeded",
      summary: "Seen in Discover",
      data: { itemId, revision, ...(topicKey ? { topicKey } : {}) },
      createdAt: new Date().toISOString(),
    });
  }

  async dismissed(userId: number, itemIds: readonly string[]): Promise<Set<string>> {
    if (itemIds.length === 0) {
      return new Set();
    }

    const rows = await this.selectInChunks(itemIds, (chunk) =>
      this.runQuery<{ item_id: string }>(
        `SELECT DISTINCT json_extract(data, '$.itemId') AS item_id FROM activity_record
       WHERE created_by_user_id = ? AND project_id IS NULL AND capability_id = ? AND kind = 'discover.dismissed'
       AND json_extract(data, '$.itemId') IN (${chunk.map(() => "?").join(",")})`,
        [userId, DISCOVER_CAPABILITY_ID, ...chunk],
      ),
    );

    return new Set(rows.map((row) => row.item_id));
  }

  async dismiss(userId: number, itemId: string): Promise<void> {
    await new ActivityRepository(this.env).recordActivityOnce({
      id: `discover_dismissed_${userId}_${itemId}`,
      createdByUserId: userId,
      conversationId: null,
      capabilityId: DISCOVER_CAPABILITY_ID,
      groupId: itemId,
      kind: "discover.dismissed",
      status: "succeeded",
      summary: "Dismissed in Discover",
      data: { itemId },
      createdAt: new Date().toISOString(),
    });
  }
}
