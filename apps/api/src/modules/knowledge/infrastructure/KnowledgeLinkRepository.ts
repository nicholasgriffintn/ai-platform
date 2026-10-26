import type { KnowledgeRelation, KnowledgeRelationKind } from "@ngriffin_uk/polychat-schemas";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { sourceResourceSql } from "~/infrastructure/database/resource-storage";
import { sourceVisibilitySql } from "~/modules/sources/infrastructure/source-visibility";

export type ClassificationCollectionKind = "topic" | "entity";

export interface KnowledgeLinkScope {
  userId: number;
  projectId: string | null;
}

export interface ClassificationCollection {
  id: string;
  kind: ClassificationCollectionKind;
  title: string;
  description: string | null;
}

export interface SourceCollectionMembership {
  id: string;
  title: string;
  kind: string;
}

function ownerClause(
  scope: KnowledgeLinkScope,
  alias?: string,
): { sql: string; values: unknown[] } {
  const column = (name: string) => (alias ? `${alias}.${name}` : name);

  return scope.projectId
    ? { sql: `${column("project_id")} = ?`, values: [scope.projectId] }
    : {
        sql: `${column("project_id")} IS NULL AND ${column("created_by_user_id")} = ?`,
        values: [scope.userId],
      };
}

export class KnowledgeLinkRepository extends BaseRepository {
  async ensureClassificationCollections(
    scope: KnowledgeLinkScope,
    collections: readonly ClassificationCollection[],
  ): Promise<void> {
    if (collections.length === 0) {
      return;
    }

    await this.env.DB.batch(
      collections.map((collection) =>
        this.env.DB.prepare(
          `INSERT OR IGNORE INTO resource_collection
             (id, collection_type, created_by_user_id, project_id, title, description, kind)
           VALUES (?, 'source', ?, ?, ?, ?, ?)`,
        ).bind(
          collection.id,
          scope.userId,
          scope.projectId,
          collection.title,
          collection.description,
          collection.kind,
        ),
      ),
    );
  }

  listClassificationTitles(
    scope: KnowledgeLinkScope,
    kind: ClassificationCollectionKind,
  ): Promise<{ title: string }[]> {
    const owner = ownerClause(scope);

    return this.runQuery<{ title: string }>(
      `SELECT title FROM resource_collection
       WHERE collection_type = 'source' AND kind = ? AND ${owner.sql}
       ORDER BY updated_at DESC LIMIT 200`,
      [kind, ...owner.values],
    );
  }

  async replaceClassificationLinks(
    sourceId: string,
    collectionIds: readonly string[],
  ): Promise<void> {
    await this.env.DB.batch([
      this.env.DB.prepare(
        `DELETE FROM resource_link WHERE kind = 'source_collection' AND source_id = ?
           AND collection_id IN (SELECT id FROM resource_collection WHERE kind IN ('topic', 'entity'))
           AND collection_id NOT IN (SELECT value FROM json_each(?))`,
      ).bind(sourceId, JSON.stringify(collectionIds)),
      ...collectionIds.map((collectionId) =>
        this.env.DB.prepare(
          "INSERT OR IGNORE INTO resource_link (kind, collection_id, source_id) VALUES ('source_collection', ?, ?)",
        ).bind(collectionId, sourceId),
      ),
      this.env.DB.prepare(
        `UPDATE resource_collection SET updated_at = CURRENT_TIMESTAMP
         WHERE id IN (SELECT value FROM json_each(?))`,
      ).bind(JSON.stringify(collectionIds)),
    ]);
  }

  listSourceCollections(sourceId: string): Promise<SourceCollectionMembership[]> {
    return this.runQuery<SourceCollectionMembership>(
      `SELECT c.id, c.title, c.kind FROM resource_link l
       JOIN resource_collection c ON c.id = l.collection_id
       WHERE l.kind = 'source_collection' AND l.source_id = ?
       ORDER BY c.kind, c.title`,
      [sourceId],
    );
  }

  findByContentHash(
    scope: KnowledgeLinkScope,
    contentHash: string,
    excludeId: string,
  ): Promise<{ id: string }[]> {
    return this.runQuery<{ id: string }>(
      `SELECT id FROM resource
       WHERE resource_type = 'source' AND scope_id = ?
         AND json_extract(metadata, '$.enrichments.relate.contentHash') = ? AND id != ?
       LIMIT 20`,
      [scope.projectId ?? String(scope.userId), contentHash, excludeId],
    );
  }

  existingInScope(scope: KnowledgeLinkScope, ids: readonly string[]): Promise<{ id: string }[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }

    const owner = ownerClause(scope, "s");

    return this.runQuery<{ id: string }>(
      `SELECT s.id FROM ${sourceResourceSql} s
       WHERE s.id IN (SELECT value FROM json_each(?)) AND ${owner.sql} AND ${sourceVisibilitySql("s")}`,
      [JSON.stringify(ids), ...owner.values],
    );
  }

  async replaceRelations(
    sourceId: string,
    relations: readonly { relatedSourceId: string; relation: KnowledgeRelationKind }[],
  ): Promise<void> {
    await this.env.DB.batch([
      this.env.DB.prepare(
        "DELETE FROM resource_link WHERE kind = 'source_relation' AND source_id = ?",
      ).bind(sourceId),
      ...relations.map((relation) =>
        this.env.DB.prepare(
          `INSERT OR IGNORE INTO resource_link (kind, source_id, related_source_id, relation)
           VALUES ('source_relation', ?, ?, ?)`,
        ).bind(sourceId, relation.relatedSourceId, relation.relation),
      ),
    ]);
  }

  listRelations(sourceId: string): Promise<KnowledgeRelation[]> {
    return this.runQuery<KnowledgeRelation>(
      `SELECT l.source_id AS sourceId, l.related_source_id AS relatedSourceId, l.relation,
         CASE WHEN l.source_id = ? THEN related.title ELSE origin.title END AS title
       FROM resource_link l
       JOIN ${sourceResourceSql} origin ON origin.id = l.source_id
       JOIN ${sourceResourceSql} related ON related.id = l.related_source_id
       WHERE l.kind = 'source_relation' AND (l.source_id = ? OR l.related_source_id = ?)
         AND ${sourceVisibilitySql("origin")} AND ${sourceVisibilitySql("related")}
       ORDER BY l.created_at DESC LIMIT 50`,
      [sourceId, sourceId, sourceId],
    );
  }
}
