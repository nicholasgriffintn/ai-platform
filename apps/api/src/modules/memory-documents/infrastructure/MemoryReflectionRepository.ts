import type { MemoryReflectionTaskData } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type {
  MemoryDocumentRow,
  MemoryReflectionResultRow,
} from "~/infrastructure/database/schema";

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

export class MemoryReflectionRepository extends BaseRepository {
  async checkpoint(contextId: string, conversationId: string): Promise<string | null> {
    const row = await this.runQuery<{ message_id: string }>(
      "SELECT message_id FROM memory_reflection_checkpoint WHERE context_id = ? AND conversation_id = ?",
      [contextId, conversationId],
      true,
    );

    return row?.message_id ?? null;
  }

  async outcome(operationId: string): Promise<MemoryReflectionResultRow | null> {
    return this.runQuery<MemoryReflectionResultRow>(
      "SELECT * FROM memory_reflection_result WHERE id = ?",
      [operationId],
      true,
    );
  }

  async commit(input: CommitMemoryReflection): Promise<MemoryReflectionResultRow | null> {
    const changed = input.content !== input.base.content;
    const revision = input.base.revision + Number(changed);

    await this.executeBatch([
      this.env.DB.prepare(`INSERT OR IGNORE INTO memory_reflection_result
        (id, context_id, conversation_id, through_message_id, revision, status, evidence_json)
        SELECT ?, ?, ?, ?, ?, ?, ? FROM memory_document d
        WHERE d.id = ? AND d.revision = ? AND d.deleted_at IS NULL
          AND (SELECT message_id FROM memory_reflection_checkpoint WHERE context_id = ? AND conversation_id = ?) IS ?
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
      this.env.DB.prepare(`UPDATE memory_document SET content = ?, revision = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND revision = ? AND ? = 1
          AND EXISTS (SELECT 1 FROM memory_reflection_result WHERE id = ? AND revision = ?)
          AND NOT EXISTS (SELECT 1 FROM memory_document_revision WHERE document_id = ? AND operation_id = ?)`).bind(
        input.content,
        revision,
        input.base.id,
        input.base.revision,
        Number(changed),
        input.operationId,
        revision,
        input.base.id,
        input.operationId,
      ),
      this.env.DB.prepare(`INSERT INTO memory_document_revision
        (id, document_id, revision, content, tier, summary, change_note, created_by, operation_id)
        SELECT ?, id, revision, content, tier, summary, ?, ?, ? FROM memory_document WHERE id = ? AND changes() > 0`).bind(
        generateId(),
        input.changeNote,
        input.userId,
        input.operationId,
        input.base.id,
      ),
      this.env.DB.prepare(`INSERT INTO memory_reflection_checkpoint (id, context_id, conversation_id, message_id)
        SELECT ?, context_id, conversation_id, through_message_id FROM memory_reflection_result WHERE id = ?
          AND (SELECT message_id FROM memory_reflection_checkpoint WHERE context_id = ? AND conversation_id = ?) IS ?
        ON CONFLICT(context_id, conversation_id) DO UPDATE SET message_id = excluded.message_id, updated_at = CURRENT_TIMESTAMP`).bind(
        generateId(),
        input.operationId,
        input.contextId,
        input.conversationId,
        input.afterMessageId,
      ),
    ]);

    return this.outcome(input.operationId);
  }

  async latestTask(contextId: string, userId: number) {
    return this.runQuery<{ id: string; status: string; error_message: string | null }>(
      `SELECT id, status, error_message FROM tasks WHERE task_type = 'memory_reflection'
       AND user_id = ? AND json_extract(task_data, '$.contextId') = ?
       ORDER BY CASE WHEN status IN ('pending', 'queued', 'running') THEN 0 ELSE 1 END,
         created_at DESC, rowid DESC LIMIT 1`,
      [userId, contextId],
      true,
    );
  }

  async latestSourceTask(input: MemoryReflectionTaskData, userId: number) {
    return this.runQuery<{ id: string; status: string }>(
      `SELECT id, status FROM tasks WHERE task_type = 'memory_reflection' AND user_id = ?
        AND json_extract(task_data, '$.contextId') = ?
        AND json_extract(task_data, '$.conversationId') = ?
        AND json_extract(task_data, '$.throughMessageId') = ?
        AND json_extract(task_data, '$.afterMessageId') IS ?
        AND json_extract(task_data, '$.reason') = ?
        ORDER BY created_at DESC, rowid DESC LIMIT 1`,
      [
        userId,
        input.contextId,
        input.conversationId,
        input.throughMessageId,
        input.afterMessageId,
        input.reason,
      ],
      true,
    );
  }
}
