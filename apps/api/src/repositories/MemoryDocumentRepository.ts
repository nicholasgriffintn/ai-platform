import type { MemoryDocumentRow, MemoryDocumentRevisionRow } from "~/lib/database/schema";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { BaseRepository } from "./BaseRepository";

export interface MemoryDocumentScopeKey {
  scopeType: "personal" | "project";
  scopeId: string;
}

export interface CreateMemoryDocumentRecord extends MemoryDocumentScopeKey {
  kind?: "memory" | "conversation_brief" | "teammate_context";
  name: string;
  content: string;
  createdByUserId: number;
  operationId?: string;
}

export interface AppendMemoryDocumentRevision {
  documentId: string;
  content: string;
  changeNote?: string | null;
  createdByUserId: number;
  expectedRevision: number;
  operationId?: string;
}

export class MemoryDocumentRepository extends BaseRepository {
  public async listDocuments(scope: MemoryDocumentScopeKey): Promise<MemoryDocumentRow[]> {
    return this.runQuery<MemoryDocumentRow>(
      `SELECT * FROM memory_document
       WHERE scope_type = ? AND scope_id = ? AND kind = 'memory' AND deleted_at IS NULL
       ORDER BY name ASC`,
      [scope.scopeType, scope.scopeId],
    );
  }

  public async getDocumentByName(
    scope: MemoryDocumentScopeKey,
    name: string,
  ): Promise<MemoryDocumentRow | null> {
    return this.runQuery<MemoryDocumentRow>(
      `SELECT * FROM memory_document
       WHERE scope_type = ? AND scope_id = ? AND kind = 'memory' AND name = ? AND deleted_at IS NULL`,
      [scope.scopeType, scope.scopeId, name],
      true,
    );
  }

  public async getDocumentById(documentId: string): Promise<MemoryDocumentRow | null> {
    return this.runQuery<MemoryDocumentRow>(
      "SELECT * FROM memory_document WHERE id = ? AND deleted_at IS NULL",
      [documentId],
      true,
    );
  }

  public async createDocument(record: CreateMemoryDocumentRecord): Promise<MemoryDocumentRow> {
    const id = generateId();

    await this.executeBatch([
      this.env.DB.prepare(
        `INSERT INTO memory_document
           (id, scope_type, scope_id, kind, name, content, revision, created_by)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      ).bind(
        id,
        record.scopeType,
        record.scopeId,
        record.kind ?? "memory",
        record.name,
        record.content,
        record.createdByUserId,
      ),
      this.env.DB.prepare(
        `INSERT INTO memory_document_revision
           (id, document_id, revision, content, change_note, created_by, operation_id)
         VALUES (?, ?, 1, ?, 'Created', ?, ?)`,
      ).bind(generateId(), id, record.content, record.createdByUserId, record.operationId ?? null),
    ]);

    const created = await this.getDocumentById(id);

    if (!created) {
      throw new AssistantError("Could not create the memory document", ErrorType.DATABASE_ERROR);
    }

    return created;
  }

  public async appendRevision(
    input: AppendMemoryDocumentRevision,
  ): Promise<MemoryDocumentRow | null> {
    const nextRevision = input.expectedRevision + 1;
    const operationId = input.operationId ?? null;
    const results = await this.executeBatch([
      this.env.DB.prepare(
        `UPDATE memory_document
         SET content = ?, revision = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND revision = ? AND deleted_at IS NULL
           AND (? IS NULL OR NOT EXISTS (
             SELECT 1 FROM memory_document_revision
             WHERE document_id = ? AND operation_id = ?
           ))`,
      ).bind(
        input.content,
        nextRevision,
        input.documentId,
        input.expectedRevision,
        operationId,
        input.documentId,
        operationId,
      ),
      this.env.DB.prepare(
        `INSERT INTO memory_document_revision
           (id, document_id, revision, content, change_note, created_by, operation_id)
         SELECT ?, ?, ?, ?, ?, ?, ?
         WHERE changes() > 0`,
      ).bind(
        generateId(),
        input.documentId,
        nextRevision,
        input.content,
        input.changeNote ?? null,
        input.createdByUserId,
        operationId,
      ),
    ]);

    if (!results[0]?.meta?.changes) {
      if (!operationId || !(await this.hasOperation(input.documentId, operationId))) {
        return null;
      }
    }

    return this.getDocumentById(input.documentId);
  }

  public async softDeleteDocument(documentId: string): Promise<void> {
    await this.executeRun(
      "UPDATE memory_document SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL",
      [documentId],
    );
  }

  public async listRevisions(documentId: string): Promise<MemoryDocumentRevisionRow[]> {
    return this.runQuery<MemoryDocumentRevisionRow>(
      `SELECT * FROM memory_document_revision
       WHERE document_id = ?
       ORDER BY revision DESC`,
      [documentId],
    );
  }

  public async searchDocuments(
    scope: MemoryDocumentScopeKey,
    query: string,
    limit: number,
  ): Promise<MemoryDocumentRow[]> {
    return this.runQuery<MemoryDocumentRow>(
      `SELECT * FROM memory_document
       WHERE scope_type = ? AND scope_id = ? AND kind = 'memory' AND deleted_at IS NULL
         AND (lower(name) LIKE ? OR lower(content) LIKE ?)
       ORDER BY updated_at DESC
       LIMIT ?`,
      [scope.scopeType, scope.scopeId, `%${query}%`, `%${query}%`, limit],
    );
  }

  private async hasOperation(documentId: string, operationId: string): Promise<boolean> {
    const row = await this.runQuery<{ present: number }>(
      `SELECT 1 AS present FROM memory_document_revision
       WHERE document_id = ? AND operation_id = ?`,
      [documentId, operationId],
      true,
    );

    return row !== null;
  }
}
