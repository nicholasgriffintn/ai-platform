import { BaseRepository } from "~/infrastructure/database/BaseRepository";

export interface ArticleFactRecord {
  id: string;
  url: string;
  outlet_id: string;
  outlet_name: string;
  headline: string;
  standfirst: string;
  published_at: string;
  first_seen_at: string;
  language: string | null;
  topic_key: string | null;
  story_id: string;
  image_url: string | null;
}

export class ArticleFactRepository extends BaseRepository {
  async listByIds(ids: readonly string[]): Promise<ArticleFactRecord[]> {
    return this.selectInChunks(ids, (chunk) =>
      this.runQuery<ArticleFactRecord>(
        `SELECT * FROM article_fact WHERE id IN (${chunk.map(() => "?").join(", ")})`,
        chunk,
      ),
    );
  }

  async listByUrls(urls: readonly string[]): Promise<ArticleFactRecord[]> {
    return this.selectInChunks(urls, (chunk) =>
      this.runQuery<ArticleFactRecord>(
        `SELECT * FROM article_fact WHERE url IN (${chunk.map(() => "?").join(", ")})`,
        chunk,
      ),
    );
  }

  async listForStory(storyId: string, limit: number): Promise<ArticleFactRecord[]> {
    return this.runQuery<ArticleFactRecord>(
      "SELECT * FROM article_fact WHERE story_id = ? ORDER BY published_at DESC LIMIT ?",
      [storyId, limit],
    );
  }

  async listTextBetween(
    since: string,
    until: string,
  ): Promise<Pick<ArticleFactRecord, "headline" | "standfirst">[]> {
    return this.runQuery<Pick<ArticleFactRecord, "headline" | "standfirst">>(
      "SELECT headline, standfirst FROM article_fact WHERE published_at >= ? AND published_at <= ?",
      [since, until],
    );
  }

  async listAllByPublished(): Promise<ArticleFactRecord[]> {
    return this.runQuery<ArticleFactRecord>("SELECT * FROM article_fact ORDER BY published_at, id");
  }

  async hasAny(): Promise<boolean> {
    return (
      (await this.runQuery<{ id: string }>("SELECT id FROM article_fact LIMIT 1", [], true)) !==
      null
    );
  }

  async insert(fact: ArticleFactRecord): Promise<boolean> {
    const result = await this.executeRun(
      `INSERT INTO article_fact (id, url, outlet_id, outlet_name, headline, standfirst, published_at,
         first_seen_at, language, topic_key, story_id, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
      [
        fact.id,
        fact.url,
        fact.outlet_id,
        fact.outlet_name,
        fact.headline,
        fact.standfirst,
        fact.published_at,
        fact.first_seen_at,
        fact.language,
        fact.topic_key,
        fact.story_id,
        fact.image_url,
      ],
    );

    return (result.meta.changes ?? 0) > 0;
  }
}
