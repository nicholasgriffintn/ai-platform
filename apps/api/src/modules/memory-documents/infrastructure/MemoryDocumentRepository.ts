import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type {
  MemoryDocumentRow,
  MemoryDocumentRevisionRow,
  MemoryReflectionResultRow,
} from "~/infrastructure/database/schema";

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

export interface CommitMemoryReflection {
  operationId: string;
  contextId: string;
  conversationId: string;
  afterMessageId: string | null;
  throughMessageId: string;
  base: MemoryDocumentRow;
  content: string;
  changeNote: string;
  evidenceJson: string;
  userId: number;
  taskId: string;
  ownerToken: string;
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
        `INSERT INTO resource_revision
           (resource_type, id, document_id, revision, text_content, change_note, created_by, operation_id)
         VALUES ('memory', ?, ?, 1, ?, 'Created', ?, ?)`,
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
    const operationId = input.operationId ?? null;
    const results = await this.executeBatch(this.revisionStatements(input));

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
      `SELECT *, text_content AS content FROM resource_revision
       WHERE resource_type = 'memory' AND document_id = ?
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

  async reflectionCheckpoint(contextId: string, conversationId: string): Promise<string | null> {
    const row = await this.runQuery<{ message_id: string }>(
      "SELECT through_message_id AS message_id FROM memory_reflection WHERE record_kind = 'checkpoint' AND context_id = ? AND conversation_id = ?",
      [contextId, conversationId],
      true,
    );

    return row?.message_id ?? null;
  }

  async reflectionOutcome(operationId: string): Promise<MemoryReflectionResultRow | null> {
    return this.runQuery<MemoryReflectionResultRow>(
      "SELECT * FROM memory_reflection WHERE record_kind = 'result' AND id = ?",
      [operationId],
      true,
    );
  }

  async commitReflection(input: CommitMemoryReflection): Promise<MemoryReflectionResultRow | null> {
    const changed = input.content !== input.base.content;
    const revision = input.base.revision + Number(changed);

    await this.executeBatch([
      this.env.DB.prepare(`INSERT OR IGNORE INTO memory_reflection
        (record_kind, id, context_id, conversation_id, through_message_id, revision, status, evidence_json)
        SELECT 'result', ?, ?, ?, ?, ?, ?, ? FROM memory_document d
        WHERE d.id = ? AND d.revision = ? AND d.deleted_at IS NULL
          AND (SELECT through_message_id AS message_id FROM memory_reflection WHERE record_kind = 'checkpoint' AND context_id = ? AND conversation_id = ?) IS ?
          AND EXISTS (SELECT 1 FROM teammate_context c WHERE c.id = ? AND c.status = 'active' AND c.actor_user_id = ? AND c.memory_document_id = d.id)
          AND EXISTS (SELECT 1 FROM tasks t WHERE t.id = ? AND t.status = 'running' AND t.execution_owner_token = ? AND julianday(t.execution_lease_expires_at) > julianday('now'))`).bind(
        input.operationId,
        input.contextId,
        input.conversationId,
        input.throughMessageId,
        revision,
        changed ? "applied" : "no_change",
        input.evidenceJson,
        input.base.id,
        input.base.revision,
        input.contextId,
        input.conversationId,
        input.afterMessageId,
        input.contextId,
        input.userId,
        input.taskId,
        input.ownerToken,
      ),
      ...(changed
        ? this.revisionStatements(
            {
              documentId: input.base.id,
              expectedRevision: input.base.revision,
              content: input.content,
              changeNote: input.changeNote,
              createdByUserId: input.userId,
              operationId: input.operationId,
            },
            input.operationId,
          )
        : []),
      this.env.DB.prepare(`INSERT INTO memory_reflection (record_kind, id, context_id, conversation_id, through_message_id)
        SELECT 'checkpoint', ?, context_id, conversation_id, through_message_id FROM memory_reflection WHERE record_kind = 'result' AND id = ?
          AND (SELECT through_message_id AS message_id FROM memory_reflection WHERE record_kind = 'checkpoint' AND context_id = ? AND conversation_id = ?) IS ?
        ON CONFLICT(context_id, conversation_id) WHERE record_kind = 'checkpoint' DO UPDATE SET through_message_id = excluded.through_message_id, updated_at = CURRENT_TIMESTAMP`).bind(
        generateId(),
        input.operationId,
        input.contextId,
        input.conversationId,
        input.afterMessageId,
      ),
    ]);

    return this.reflectionOutcome(input.operationId);
  }

  private revisionStatements(input: AppendMemoryDocumentRevision, reflectionOperationId?: string) {
    const nextRevision = input.expectedRevision + 1;
    const operationId = input.operationId ?? null;

    return [
      this.env.DB.prepare(
        `UPDATE memory_document
         SET content = ?, revision = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND revision = ? AND deleted_at IS NULL
           AND (? IS NULL OR NOT EXISTS (
             SELECT 1 FROM resource_revision
             WHERE resource_type = 'memory' AND document_id = ? AND operation_id = ?
           ))${reflectionOperationId ? " AND EXISTS (SELECT 1 FROM memory_reflection WHERE record_kind = 'result' AND id = ? AND revision = ? AND status = 'applied')" : ""}`,
      ).bind(
        input.content,
        nextRevision,
        input.documentId,
        input.expectedRevision,
        operationId,
        input.documentId,
        operationId,
        ...(reflectionOperationId ? [reflectionOperationId, nextRevision] : []),
      ),
      this.env.DB.prepare(
        `INSERT INTO resource_revision
           (resource_type, id, document_id, revision, text_content, change_note, created_by, operation_id)
         SELECT 'memory', ?, ?, ?, ?, ?, ?, ?
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
    ];
  }

  private async hasOperation(documentId: string, operationId: string): Promise<boolean> {
    const row = await this.runQuery<{ present: number }>(
      `SELECT 1 AS present FROM resource_revision
       WHERE resource_type = 'memory' AND document_id = ? AND operation_id = ?`,
      [documentId, operationId],
      true,
    );

    return row !== null;
  }
}
