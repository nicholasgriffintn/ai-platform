import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";

export type SourceRevisionOperation = "created" | "updated" | "restored";

export interface SourceRevisionRecord {
  id: string;
  revision: number;
  title: string;
  content: string;
  operation: SourceRevisionOperation;
  restored_from_revision: number | null;
  created_by_user_id: number;
  created_at: string;
}

export interface SourceRevisionSnapshot {
  title: string;
  content: string;
  userId: number;
}

export interface AdvanceSourceRevision {
  sourceId: string;
  expectedRevision: number;
  snapshot: SourceRevisionSnapshot | null;
  operation: Exclude<SourceRevisionOperation, "created">;
  editSession?: string;
  restoredFromRevision?: number;
}

const REVISION_COLUMNS =
  "id, revision, title, text_content AS content, operation, restored_from_revision, created_by_user_id, created_at";

export class SourceRevisionRepository extends BaseRepository {
  list(sourceId: string): Promise<SourceRevisionRecord[]> {
    return this.runQuery<SourceRevisionRecord>(
      `SELECT ${REVISION_COLUMNS} FROM resource_revision
       WHERE resource_type = 'source' AND source_id = ?
       ORDER BY revision DESC`,
      [sourceId],
    );
  }

  get(sourceId: string, revision: number): Promise<SourceRevisionRecord | null> {
    return this.runQuery<SourceRevisionRecord>(
      `SELECT ${REVISION_COLUMNS} FROM resource_revision
       WHERE resource_type = 'source' AND source_id = ? AND revision = ?`,
      [sourceId, revision],
      true,
    );
  }

  async recordBaseline(
    sourceId: string,
    revision: number,
    snapshot: SourceRevisionSnapshot,
    createdAt: string,
  ): Promise<void> {
    await this.executeRun(
      `INSERT INTO resource_revision
         (resource_type, id, source_id, revision, title, text_content, operation, created_by_user_id, created_at)
       SELECT 'source', ?, ?, ?, ?, ?, 'created', ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM resource_revision WHERE resource_type = 'source' AND source_id = ?)`,
      [
        generateId(),
        sourceId,
        revision,
        snapshot.title,
        snapshot.content,
        snapshot.userId,
        createdAt,
        sourceId,
      ],
    );
  }

  async advance(input: AdvanceSourceRevision): Promise<number | null> {
    const nextRevision = input.expectedRevision + 1;
    const statements = [
      this.env.DB.prepare(
        `UPDATE resource SET revision = ?, updated_at = CURRENT_TIMESTAMP
         WHERE resource_type = 'source' AND id = ? AND revision = ?`,
      ).bind(nextRevision, input.sourceId, input.expectedRevision),
    ];

    if (input.snapshot) {
      statements.push(
        this.env.DB.prepare(
          `INSERT INTO resource_revision
             (resource_type, id, source_id, revision, title, text_content, operation, restored_from_revision, created_by_user_id, operation_id)
           SELECT 'source', ?, ?, ?, ?, ?, ?, ?, ?, ?
           WHERE changes() > 0
           ON CONFLICT(source_id, operation_id) WHERE source_id IS NOT NULL AND operation_id IS NOT NULL
           DO UPDATE SET revision = excluded.revision, title = excluded.title,
             text_content = excluded.text_content, created_at = CURRENT_TIMESTAMP`,
        ).bind(
          generateId(),
          input.sourceId,
          nextRevision,
          input.snapshot.title,
          input.snapshot.content,
          input.operation,
          input.restoredFromRevision ?? null,
          input.snapshot.userId,
          input.editSession ?? null,
        ),
      );
    }

    const [claimed] = await this.executeBatch(statements);

    return claimed?.meta?.changes ? nextRevision : null;
  }
}
