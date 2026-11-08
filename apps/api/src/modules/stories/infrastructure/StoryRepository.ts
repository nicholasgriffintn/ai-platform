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
  articleCount: number;
  outletCount: number;
}

export class StoryRepository extends BaseRepository {
  async get(storyId: string): Promise<StoryRecord | null> {
    return this.runQuery<StoryRecord>("SELECT * FROM story WHERE id = ?", [storyId], true);
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

  async latestVersion(storyId: string): Promise<StoryVersionRecord | null> {
    return this.runQuery<StoryVersionRecord>(
      "SELECT * FROM story_version WHERE story_id = ? ORDER BY version DESC LIMIT 1",
      [storyId],
      true,
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
         outlet_angles, article_ids, model, input_tokens, output_tokens)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
