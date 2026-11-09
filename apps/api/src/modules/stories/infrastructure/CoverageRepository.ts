import { chunkArray } from "@ngriffin_uk/polychat-utility-core";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type {
  CoverageFact,
  CoverageMention,
  CoverageRow,
  TermRow,
} from "~/modules/stories/domain/coverage";

const COVERAGE_COLUMNS = 7;
const TERM_COLUMNS = 6;

interface CoverageFactRow {
  story_id: string;
  outlet_id: string;
  outlet_name: string;
  topic_key: string | null;
  is_lead: number;
}

export interface StoryOutletRow {
  outlet_id: string;
  outlet_name: string;
  article_count: number;
  lead_count: number;
  first_published_at: string;
}

export class CoverageRepository extends BaseRepository {
  async listFactsForDay(day: string): Promise<CoverageFact[]> {
    const rows = await this.runQuery<CoverageFactRow>(
      `SELECT f.story_id, f.outlet_id, f.outlet_name, f.topic_key,
         f.id = (SELECT first.id FROM article_fact first WHERE first.story_id = f.story_id
                 ORDER BY first.published_at, first.id LIMIT 1) AS is_lead
       FROM article_fact f
       WHERE f.published_at >= ? AND f.published_at < date(?, '+1 day')`,
      [day, day],
    );

    return rows.map((row) => ({
      storyId: row.story_id,
      outletId: row.outlet_id,
      outletName: row.outlet_name,
      topicKey: row.topic_key,
      isLead: row.is_lead === 1,
    }));
  }

  async listMentions(storyIds: readonly string[]): Promise<CoverageMention[]> {
    const rows = await this.selectInChunks(storyIds, (chunk) =>
      this.runQuery<{ story_id: string; entity_id: string; name: string }>(
        `SELECT m.story_id, m.entity_id, e.name
         FROM entity_mention m JOIN entity e ON e.id = m.entity_id
         WHERE m.story_id IN (${chunk.map(() => "?").join(", ")})`,
        chunk,
      ),
    );

    return rows.map((row) => ({ storyId: row.story_id, entityId: row.entity_id, name: row.name }));
  }

  async replaceDay(day: string, coverage: readonly CoverageRow[], terms: readonly TermRow[]) {
    const coverageInserts = chunkArray(
      [...coverage],
      BaseRepository.rowsPerInsert(COVERAGE_COLUMNS),
    ).map((rows) =>
      this.env.DB.prepare(
        `INSERT INTO coverage_daily (day, subject_kind, subject_key, outlet_id, outlet_name,
           article_count, lead_count)
         VALUES ${rows.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ")}`,
      ).bind(
        ...rows.flatMap((row) => [
          row.day,
          row.subjectKind,
          row.subjectKey,
          row.outletId,
          row.outletName,
          row.articleCount,
          row.leadCount,
        ]),
      ),
    );
    const termInserts = chunkArray([...terms], BaseRepository.rowsPerInsert(TERM_COLUMNS)).map(
      (rows) =>
        this.env.DB.prepare(
          `INSERT INTO term_daily (day, term_kind, term_key, term, article_count, story_count)
           VALUES ${rows.map(() => "(?, ?, ?, ?, ?, ?)").join(", ")}`,
        ).bind(
          ...rows.flatMap((row) => [
            row.day,
            row.termKind,
            row.termKey,
            row.term,
            row.articleCount,
            row.storyCount,
          ]),
        ),
    );

    await this.executeBatch([
      this.env.DB.prepare("DELETE FROM coverage_daily WHERE day = ?").bind(day),
      this.env.DB.prepare("DELETE FROM term_daily WHERE day = ?").bind(day),
      ...coverageInserts,
      ...termInserts,
    ]);
  }

  async listDayRange(): Promise<{ first: string | null; last: string | null }> {
    const row = await this.runQuery<{ first: string | null; last: string | null }>(
      "SELECT MIN(day) AS first, MAX(day) AS last FROM coverage_daily WHERE article_count > 0",
      [],
      true,
    );

    return { first: row?.first ?? null, last: row?.last ?? null };
  }

  async listCoverageRows(since: string, until: string): Promise<CoverageRow[]> {
    const rows = await this.runQuery<{
      day: string;
      subject_kind: CoverageRow["subjectKind"];
      subject_key: string;
      outlet_id: string;
      outlet_name: string;
      article_count: number;
      lead_count: number;
    }>("SELECT * FROM coverage_daily WHERE day >= ? AND day <= ?", [since, until]);

    return rows.map((row) => ({
      day: row.day,
      subjectKind: row.subject_kind,
      subjectKey: row.subject_key,
      outletId: row.outlet_id,
      outletName: row.outlet_name,
      articleCount: row.article_count,
      leadCount: row.lead_count,
    }));
  }

  async listTermRows(since: string, until: string): Promise<TermRow[]> {
    const rows = await this.runQuery<{
      day: string;
      term_kind: TermRow["termKind"];
      term_key: string;
      term: string;
      article_count: number;
      story_count: number;
    }>("SELECT * FROM term_daily WHERE day >= ? AND day <= ?", [since, until]);

    return rows.map((row) => ({
      day: row.day,
      termKind: row.term_kind,
      termKey: row.term_key,
      term: row.term,
      articleCount: row.article_count,
      storyCount: row.story_count,
    }));
  }

  async firstFactDay(): Promise<string | null> {
    const row = await this.runQuery<{ day: string | null }>(
      "SELECT substr(MIN(published_at), 1, 10) AS day FROM article_fact",
      [],
      true,
    );

    return row?.day ?? null;
  }

  async listStoryOutlets(storyId: string): Promise<StoryOutletRow[]> {
    return this.runQuery<StoryOutletRow>(
      `SELECT f.outlet_id, MAX(f.outlet_name) AS outlet_name, COUNT(*) AS article_count,
         SUM(CASE WHEN f.id = (SELECT first.id FROM article_fact first WHERE first.story_id = f.story_id
                               ORDER BY first.published_at, first.id LIMIT 1) THEN 1 ELSE 0 END) AS lead_count,
         MIN(f.published_at) AS first_published_at
       FROM article_fact f WHERE f.story_id = ?
       GROUP BY f.outlet_id
       ORDER BY first_published_at`,
      [storyId],
    );
  }

  async listEntityOutlets(entityId: string, limit: number): Promise<StoryOutletRow[]> {
    return this.runQuery<StoryOutletRow>(
      `SELECT f.outlet_id, MAX(f.outlet_name) AS outlet_name, COUNT(*) AS article_count,
         0 AS lead_count, MIN(f.published_at) AS first_published_at
       FROM entity_mention m JOIN article_fact f ON f.story_id = m.story_id
       WHERE m.entity_id = ?
       GROUP BY f.outlet_id
       ORDER BY article_count DESC, outlet_name
       LIMIT ?`,
      [entityId, limit],
    );
  }
}
