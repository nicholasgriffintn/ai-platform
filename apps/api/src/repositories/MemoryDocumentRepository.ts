import type { MemoryDocumentRow, MemoryDocumentRevisionRow } from "~/lib/database/schema";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { BaseRepository } from "./BaseRepository";

export interface MemoryDocumentScopeKey {
  scopeType: "personal" | "project";
  scopeId: string;
}

export interface CreateMemoryDocumentRecord extends MemoryDocumentScopeKey {
  name: string;
  content: string;
  createdByUserId: number;
}

export interface AppendMemoryDocumentRevision {
  documentId: string;
  content: string;
  changeNote?: string | null;
  createdByUserId: number;
  expectedRevision: number;
}

export class MemoryDocumentRepository extends BaseRepository {
  public async listDocuments(scope: MemoryDocumentScopeKey): Promise<MemoryDocumentRow[]> {
    return this.runQuery<MemoryDocumentRow>(
      `SELECT * FROM memory_document
       WHERE scope_type = ? AND scope_id = ? AND deleted_at IS NULL
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
       WHERE scope_type = ? AND scope_id = ? AND name = ? AND deleted_at IS NULL`,
      [scope.scopeType, scope.scopeId, name],
      true,
    );
  }

  public async createDocument(record: CreateMemoryDocumentRecord): Promise<MemoryDocumentRow> {
    const id = generateId();
    const insert = this.buildInsertQuery(
      "memory_document",
      {
        id,
        scope_type: record.scopeType,
        scope_id: record.scopeId,
        name: record.name,
        content: record.content,
        revision: 1,
        created_by: record.createdByUserId,
      },
      { returning: "*" },
    );

    if (!insert) {
      throw new AssistantError(
        "Could not build the memory document insert",
        ErrorType.INTERNAL_ERROR,
      );
    }

    const created = await this.runQuery<MemoryDocumentRow>(insert.query, insert.values, true);

    if (!created) {
      throw new AssistantError("Could not create the memory document", ErrorType.DATABASE_ERROR);
    }

    await this.writeRevision({
      documentId: id,
      revision: 1,
      content: record.content,
      changeNote: "Created",
      createdByUserId: record.createdByUserId,
    });

    return created;
  }

  public async appendRevision(
    input: AppendMemoryDocumentRevision,
  ): Promise<MemoryDocumentRow | null> {
    const nextRevision = input.expectedRevision + 1;
    const result = await this.executeRun(
      `UPDATE memory_document
       SET content = ?, revision = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND revision = ? AND deleted_at IS NULL`,
      [input.content, nextRevision, input.documentId, input.expectedRevision],
    );

    if (!result.meta?.changes) {
      return null;
    }

    await this.writeRevision({
      documentId: input.documentId,
      revision: nextRevision,
      content: input.content,
      changeNote: input.changeNote ?? null,
      createdByUserId: input.createdByUserId,
    });

    return this.runQuery<MemoryDocumentRow>(
      "SELECT * FROM memory_document WHERE id = ?",
      [input.documentId],
      true,
    );
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
       WHERE scope_type = ? AND scope_id = ? AND deleted_at IS NULL
         AND (lower(name) LIKE ? OR lower(content) LIKE ?)
       ORDER BY updated_at DESC
       LIMIT ?`,
      [scope.scopeType, scope.scopeId, `%${query}%`, `%${query}%`, limit],
    );
  }

  private async writeRevision(input: {
    documentId: string;
    revision: number;
    content: string;
    changeNote: string | null;
    createdByUserId: number;
  }): Promise<void> {
    await this.executeRun(
      `INSERT INTO memory_document_revision
         (id, document_id, revision, content, change_note, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        input.documentId,
        input.revision,
        input.content,
        input.changeNote,
        input.createdByUserId,
      ],
    );
  }
}
