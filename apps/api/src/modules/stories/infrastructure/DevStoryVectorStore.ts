import { cosineSimilarity } from "@ngriffin_uk/polychat-utility-core";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { IEnv } from "~/types";

import type { StoryVectorStore, VectorMetadata, VectorStoreMatch } from "./StoryVectorStore";

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS dev_story_vector (
  namespace TEXT NOT NULL,
  id TEXT NOT NULL,
  vector_values TEXT NOT NULL,
  published_at INTEGER,
  metadata TEXT NOT NULL,
  PRIMARY KEY (namespace, id)
)`;

interface DevVectorRow {
  id: string;
  vector_values: string;
  metadata: string;
}

function readValues(row: DevVectorRow): number[] {
  const values: unknown = JSON.parse(row.vector_values);

  return Array.isArray(values) ? values.filter((value) => typeof value === "number") : [];
}

export class DevStoryVectorStore implements StoryVectorStore {
  private ready: Promise<unknown> | null = null;

  constructor(
    private readonly env: IEnv,
    private readonly namespace: string,
  ) {}

  async remove(id: string): Promise<void> {
    await this.ensureTable();
    await this.env.DB.prepare("DELETE FROM dev_story_vector WHERE namespace = ? AND id = ?")
      .bind(this.namespace, id)
      .run();
  }

  async clear(): Promise<void> {
    await this.ensureTable();
    await this.env.DB.prepare("DELETE FROM dev_story_vector WHERE namespace = ?")
      .bind(this.namespace)
      .run();
  }

  private ensureTable(): Promise<unknown> {
    this.ready ??= this.env.DB.prepare(CREATE_TABLE).run();

    return this.ready;
  }

  async query(
    vector: readonly number[],
    topK: number,
    window?: { since: number; until: number },
  ): Promise<VectorStoreMatch[]> {
    await this.ensureTable();

    const statement = window
      ? this.env.DB.prepare(
          `SELECT id, vector_values, metadata FROM dev_story_vector
           WHERE namespace = ? AND published_at >= ? AND published_at <= ?`,
        ).bind(this.namespace, window.since, window.until)
      : this.env.DB.prepare(
          "SELECT id, vector_values, metadata FROM dev_story_vector WHERE namespace = ?",
        ).bind(this.namespace);
    const { results } = await statement.all<DevVectorRow>();

    return results
      .map((row) => ({
        id: row.id,
        score: cosineSimilarity(vector, readValues(row)),
        metadata: parseJsonRecord(row.metadata),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, topK);
  }

  async upsert(id: string, values: readonly number[], metadata: VectorMetadata): Promise<void> {
    await this.ensureTable();
    await this.env.DB.prepare(
      `INSERT INTO dev_story_vector (namespace, id, vector_values, published_at, metadata)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (namespace, id) DO UPDATE SET vector_values = excluded.vector_values,
         published_at = excluded.published_at, metadata = excluded.metadata`,
    )
      .bind(
        this.namespace,
        id,
        JSON.stringify(values),
        typeof metadata.publishedAt === "number" ? metadata.publishedAt : null,
        JSON.stringify(metadata),
      )
      .run();
  }

  async get(id: string): Promise<number[] | null> {
    await this.ensureTable();

    const row = await this.env.DB.prepare(
      "SELECT id, vector_values, metadata FROM dev_story_vector WHERE namespace = ? AND id = ?",
    )
      .bind(this.namespace, id)
      .first<DevVectorRow>();

    return row ? readValues(row) : null;
  }
}
