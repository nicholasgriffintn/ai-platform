import { BaseRepository } from "~/infrastructure/database/BaseRepository";

export interface StoryRecord {
  id: string;
  slug: string;
  title: string;
  status: "open" | "closed";
  opened_at: string;
  last_article_at: string;
  closed_at: string | null;
  article_count: number;
  outlet_count: number;
  primary_topic_key: string | null;
  lead_entity_ids: string;
  version: number;
  versioned_at: string | null;
  versioned_article_count: number;
  versioned_outlet_count: number;
}

export interface StoryVersionRecord {
  story_id: string;
  version: number;
  written_at: string;
  overview: string;
  agreed: string;
  disputed: string;
  gaps: string;
  outlet_angles: string;
  article_ids: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_micros: number;
  body_count: number;
}

export interface NewStory {
  id: string;
  slug: string;
  title: string;
  openedAt: string;
  topicKey: string | null;
}

export interface NewStoryVersion {
  storyId: string;
  version: number;
  writtenAt: string;
  title: string;
  overview: readonly string[];
  agreed: readonly string[];
  disputed: readonly string[];
  gaps: readonly string[];
  outlets: readonly { source: string; angle: string }[];
  articleIds: readonly string[];
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
  bodyCount: number;
  articleCount: number;
  outletCount: number;
}

export class StoryRepository extends BaseRepository {
  async get(storyId: string): Promise<StoryRecord | null> {
    return this.runQuery<StoryRecord>("SELECT * FROM story WHERE id = ?", [storyId], true);
  }

  async listByIds(ids: readonly string[]): Promise<StoryRecord[]> {
    return this.selectInChunks(ids, (chunk) =>
      this.runQuery<StoryRecord>(
        `SELECT * FROM story WHERE id IN (${chunk.map(() => "?").join(", ")})`,
        chunk,
      ),
    );
  }

  async setLeadEntities(storyId: string, entityIds: readonly string[]): Promise<void> {
    await this.executeRun("UPDATE story SET lead_entity_ids = ? WHERE id = ?", [
      JSON.stringify(entityIds),
      storyId,
    ]);
  }

  async closeQuiet(quietSince: string, closedAt: string): Promise<number> {
    const result = await this.executeRun(
      `UPDATE story SET status = 'closed', closed_at = ?
       WHERE status = 'open' AND last_article_at < ?`,
      [closedAt, quietSince],
    );

    return result.meta.changes ?? 0;
  }

  async open(story: NewStory): Promise<void> {
    await this.executeRun(
      `INSERT INTO story (id, slug, title, status, opened_at, last_article_at, primary_topic_key)
       VALUES (?, ?, ?, 'open', ?, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
      [story.id, story.slug, story.title, story.openedAt, story.openedAt, story.topicKey],
    );
  }

  async recount(storyId: string): Promise<StoryRecord | null> {
    await this.executeRun(
      `UPDATE story SET
         article_count = (SELECT COUNT(*) FROM article_fact WHERE story_id = story.id),
         outlet_count = (SELECT COUNT(DISTINCT outlet_id) FROM article_fact WHERE story_id = story.id),
         last_article_at = COALESCE(
           (SELECT MAX(published_at) FROM article_fact WHERE story_id = story.id), last_article_at)
       WHERE id = ?`,
      [storyId],
    );

    return this.get(storyId);
  }

  async listVersions(storyId: string, limit: number): Promise<StoryVersionRecord[]> {
    return this.runQuery<StoryVersionRecord>(
      "SELECT * FROM story_version WHERE story_id = ? ORDER BY version DESC LIMIT ?",
      [storyId, limit],
    );
  }

  async listLatestVersions(storyIds: readonly string[]): Promise<StoryVersionRecord[]> {
    return this.selectInChunks(storyIds, (chunk) =>
      this.runQuery<StoryVersionRecord>(
        `SELECT v.* FROM story_version v JOIN story s ON s.id = v.story_id AND v.version = s.version
         WHERE v.story_id IN (${chunk.map(() => "?").join(", ")})`,
        chunk,
      ),
    );
  }

  async listOpenByIds(ids: readonly string[]): Promise<StoryRecord[]> {
    return (await this.listByIds(ids)).filter((story) => story.status === "open");
  }

  async listAwaitingVersion(limit: number): Promise<StoryRecord[]> {
    return this.runQuery<StoryRecord>(
      `SELECT * FROM story
       WHERE status = 'open' AND (outlet_count >= 2 OR article_count >= 3)
         AND (outlet_count > versioned_outlet_count OR article_count > versioned_article_count)
       ORDER BY last_article_at DESC LIMIT ?`,
      [limit],
    );
  }

  async mergeInto(fromStoryId: string, intoStoryId: string, leadEntityIds: readonly string[]) {
    await this.executeBatch([
      this.env.DB.prepare("UPDATE article_fact SET story_id = ? WHERE story_id = ?").bind(
        intoStoryId,
        fromStoryId,
      ),
      this.env.DB.prepare("UPDATE quote SET story_id = ? WHERE story_id = ?").bind(
        intoStoryId,
        fromStoryId,
      ),
      this.env.DB.prepare(
        `INSERT INTO entity_mention (entity_id, story_id, role, first_seen_at, last_seen_at, mention_count)
         SELECT entity_id, ?, role, first_seen_at, last_seen_at, mention_count
         FROM entity_mention WHERE story_id = ?
         ON CONFLICT (entity_id, story_id) DO UPDATE SET
           mention_count = entity_mention.mention_count + excluded.mention_count,
           last_seen_at = MAX(entity_mention.last_seen_at, excluded.last_seen_at)`,
      ).bind(intoStoryId, fromStoryId),
      this.env.DB.prepare(
        "UPDATE OR IGNORE story_edge SET from_story_id = ? WHERE from_story_id = ?",
      ).bind(intoStoryId, fromStoryId),
      this.env.DB.prepare(
        "UPDATE OR IGNORE story_edge SET to_story_id = ? WHERE to_story_id = ?",
      ).bind(intoStoryId, fromStoryId),
      this.env.DB.prepare(
        "DELETE FROM story_edge WHERE from_story_id = to_story_id OR from_story_id = ? OR to_story_id = ?",
      ).bind(fromStoryId, fromStoryId),
      this.env.DB.prepare("UPDATE story SET lead_entity_ids = ? WHERE id = ?").bind(
        JSON.stringify(leadEntityIds),
        intoStoryId,
      ),
      this.env.DB.prepare("DELETE FROM story WHERE id = ?").bind(fromStoryId),
    ]);

    return this.recount(intoStoryId);
  }

  async listOpenWithLeads(limit: number): Promise<StoryRecord[]> {
    return this.runQuery<StoryRecord>(
      `SELECT * FROM story WHERE status = 'open' AND lead_entity_ids != '[]'
       ORDER BY article_count DESC, opened_at LIMIT ?`,
      [limit],
    );
  }

  async clearGraph(): Promise<void> {
    await this.executeBatch(
      [
        "DELETE FROM story_edge",
        "DELETE FROM quote",
        "DELETE FROM entity_mention",
        "DELETE FROM entity",
        "DELETE FROM story_version",
        "DELETE FROM article_fact",
        "DELETE FROM story",
        "DELETE FROM coverage_daily",
        "DELETE FROM term_daily",
      ].map((statement) => this.env.DB.prepare(statement)),
    );
  }

  async countVersionsSince(since: string): Promise<number> {
    const row = await this.runQuery<{ total: number }>(
      "SELECT COUNT(*) AS total FROM story_version WHERE written_at >= ?",
      [since],
      true,
    );

    return row?.total ?? 0;
  }

  async writeVersion(version: NewStoryVersion): Promise<boolean> {
    const insert = this.env.DB.prepare(
      `INSERT INTO story_version (story_id, version, written_at, overview, agreed, disputed, gaps,
         outlet_angles, article_ids, model, input_tokens, output_tokens, cost_micros, body_count)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE EXISTS (SELECT 1 FROM story WHERE id = ? AND version = ?)`,
    ).bind(
      version.storyId,
      version.version,
      version.writtenAt,
      JSON.stringify(version.overview),
      JSON.stringify(version.agreed),
      JSON.stringify(version.disputed),
      JSON.stringify(version.gaps),
      JSON.stringify(version.outlets),
      JSON.stringify(version.articleIds),
      version.model,
      version.inputTokens,
      version.outputTokens,
      version.costMicros,
      version.bodyCount,
      version.storyId,
      version.version - 1,
    );
    const advance = this.env.DB.prepare(
      `UPDATE story SET version = ?, title = ?, versioned_at = ?, versioned_article_count = ?,
         versioned_outlet_count = ?
       WHERE id = ? AND version = ?`,
    ).bind(
      version.version,
      version.title,
      version.writtenAt,
      version.articleCount,
      version.outletCount,
      version.storyId,
      version.version - 1,
    );
    const [inserted] = await this.executeBatch([insert, advance]);

    return (inserted?.meta.changes ?? 0) > 0;
  }
}
