import type { StoryEdgeKind } from "@ngriffin_uk/polychat-schemas";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";

export interface StoryEdgeRecord {
  from_story_id: string;
  to_story_id: string;
  kind: StoryEdgeKind;
  score: number;
}

export interface StoryEdgeInsert {
  fromStoryId: string;
  toStoryId: string;
  kind: StoryEdgeKind;
  score: number;
  createdBy: "vector" | "entity" | "model";
  createdAt: string;
}

export class StoryEdgeRepository extends BaseRepository {
  async listFrom(storyId: string, limit: number): Promise<StoryEdgeRecord[]> {
    return this.runQuery<StoryEdgeRecord>(
      `SELECT from_story_id, to_story_id, kind, score FROM story_edge
       WHERE from_story_id = ? ORDER BY score DESC LIMIT ?`,
      [storyId, limit],
    );
  }

  async upsertMany(edges: readonly StoryEdgeInsert[]): Promise<void> {
    if (edges.length === 0) {
      return;
    }

    await this.executeBatch(
      edges.map((edge) =>
        this.env.DB.prepare(
          `INSERT INTO story_edge (from_story_id, to_story_id, kind, score, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (from_story_id, to_story_id) DO UPDATE SET kind = excluded.kind,
             score = MAX(story_edge.score, excluded.score)`,
        ).bind(
          edge.fromStoryId,
          edge.toStoryId,
          edge.kind,
          edge.score,
          edge.createdBy,
          edge.createdAt,
        ),
      ),
    );
  }
}
