import type { StoryEntityKind, StoryEntityRole } from "@ngriffin_uk/polychat-schemas";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";

export interface EntityRecord {
  id: string;
  key: string;
  name: string;
  kind: StoryEntityKind;
  aliases: string;
  wikidata_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
  mention_count: number;
}

export interface EntityMentionRecord {
  id: string;
  name: string;
  kind: StoryEntityKind;
  role: StoryEntityRole;
}

export interface EntityStoryRecord {
  story_id: string;
  role: StoryEntityRole;
}

export interface EntityUpsert {
  id: string;
  key: string;
  name: string;
  kind: StoryEntityKind;
  aliases: readonly string[];
  role: StoryEntityRole;
}

export class EntityRepository extends BaseRepository {
  async get(entityId: string): Promise<EntityRecord | null> {
    return this.runQuery<EntityRecord>("SELECT * FROM entity WHERE id = ?", [entityId], true);
  }

  async listByIds(ids: readonly string[]): Promise<EntityRecord[]> {
    return this.selectInChunks(ids, (chunk) =>
      this.runQuery<EntityRecord>(
        `SELECT * FROM entity WHERE id IN (${chunk.map(() => "?").join(", ")})`,
        chunk,
      ),
    );
  }

  async listForStory(storyId: string): Promise<EntityMentionRecord[]> {
    return this.runQuery<EntityMentionRecord>(
      `SELECT entity.id, entity.name, entity.kind, entity_mention.role
       FROM entity_mention JOIN entity ON entity.id = entity_mention.entity_id
       WHERE entity_mention.story_id = ?
       ORDER BY CASE entity_mention.role WHEN 'subject' THEN 0 WHEN 'quoted' THEN 1 ELSE 2 END,
         entity.mention_count DESC`,
      [storyId],
    );
  }

  async listStories(entityId: string, limit: number): Promise<EntityStoryRecord[]> {
    return this.runQuery<EntityStoryRecord>(
      `SELECT story_id, role FROM entity_mention WHERE entity_id = ?
       ORDER BY last_seen_at DESC LIMIT ?`,
      [entityId, limit],
    );
  }

  async recordMentions(
    storyId: string,
    entities: readonly EntityUpsert[],
    seenAt: string,
  ): Promise<void> {
    if (entities.length === 0) {
      return;
    }

    await this.executeBatch(
      entities.flatMap((entity) => [
        this.env.DB.prepare(
          `INSERT INTO entity (id, key, name, kind, aliases, first_seen_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET aliases = excluded.aliases, last_seen_at = excluded.last_seen_at`,
        ).bind(
          entity.id,
          entity.key,
          entity.name,
          entity.kind,
          JSON.stringify(entity.aliases),
          seenAt,
          seenAt,
        ),
        this.env.DB.prepare(
          `INSERT INTO entity_mention (entity_id, story_id, role, first_seen_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (entity_id, story_id) DO UPDATE SET role = excluded.role,
             last_seen_at = excluded.last_seen_at, mention_count = entity_mention.mention_count + 1`,
        ).bind(entity.id, storyId, entity.role, seenAt, seenAt),
        this.env.DB.prepare(
          `UPDATE entity SET mention_count = (SELECT COUNT(*) FROM entity_mention WHERE entity_id = ?)
           WHERE id = ?`,
        ).bind(entity.id, entity.id),
      ]),
    );
  }
}
