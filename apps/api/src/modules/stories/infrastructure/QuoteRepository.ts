import { BaseRepository } from "~/infrastructure/database/BaseRepository";

export interface QuoteRecord {
  id: string;
  story_id: string;
  article_id: string;
  outlet_id: string;
  speaker: string;
  speaker_entity_id: string | null;
  context: string;
  text: string;
  verified_at: string;
  outlet_name: string;
  url: string;
}

export interface QuoteInsert {
  id: string;
  storyId: string;
  articleId: string;
  outletId: string;
  speaker: string;
  speakerEntityId: string | null;
  context: string;
  text: string;
  verifiedAt: string;
}

const QUOTE_COLUMNS = `quote.*, article_fact.outlet_name, article_fact.url`;

export class QuoteRepository extends BaseRepository {
  async listForStory(storyId: string, limit: number): Promise<QuoteRecord[]> {
    return this.runQuery<QuoteRecord>(
      `SELECT ${QUOTE_COLUMNS} FROM quote JOIN article_fact ON article_fact.id = quote.article_id
       WHERE quote.story_id = ? ORDER BY quote.verified_at DESC LIMIT ?`,
      [storyId, limit],
    );
  }

  async listForSpeaker(entityId: string, limit: number): Promise<QuoteRecord[]> {
    return this.runQuery<QuoteRecord>(
      `SELECT ${QUOTE_COLUMNS} FROM quote JOIN article_fact ON article_fact.id = quote.article_id
       WHERE quote.speaker_entity_id = ? ORDER BY quote.verified_at DESC LIMIT ?`,
      [entityId, limit],
    );
  }

  async insertMany(quotes: readonly QuoteInsert[]): Promise<void> {
    if (quotes.length === 0) {
      return;
    }

    await this.executeBatch(
      quotes.map((quote) =>
        this.env.DB.prepare(
          `INSERT INTO quote (id, story_id, article_id, outlet_id, speaker, speaker_entity_id,
             context, text, verified_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO NOTHING`,
        ).bind(
          quote.id,
          quote.storyId,
          quote.articleId,
          quote.outletId,
          quote.speaker,
          quote.speakerEntityId,
          quote.context,
          quote.text,
          quote.verifiedAt,
        ),
      ),
    );
  }
}
