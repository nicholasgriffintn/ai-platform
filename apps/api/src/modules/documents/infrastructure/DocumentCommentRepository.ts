import { documentCommentSchema, type DocumentComment } from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";

interface DocumentCommentRow {
  id: string;
  output_id: string;
  parent_id: string | null;
  anchor_json: string | null;
  source_revision: number;
  body: string;
  author_user_id: number;
  resolved: number;
  revision: number;
  mentioned_teammate_id: string | null;
  task_id: string | null;
  created_at: string;
  updated_at: string | null;
}

const COMMENT_READ_GUARD = `EXISTS (SELECT 1 FROM output WHERE output.id = document_comment.output_id
  AND ((output.project_id IS NULL AND output.created_by_user_id = ?) OR EXISTS
    (SELECT 1 FROM project JOIN workspace_member ON workspace_member.workspace_id = project.workspace_id
      WHERE project.id = output.project_id AND workspace_member.user_id = ?)))`;

function formatComment(row: DocumentCommentRow): DocumentComment {
  return documentCommentSchema.parse({
    id: row.id,
    outputId: row.output_id,
    parentId: row.parent_id,
    anchor: row.anchor_json === null ? null : safeParseJson<unknown>(row.anchor_json),
    sourceRevision: row.source_revision,
    body: row.body,
    authorUserId: row.author_user_id,
    resolved: row.resolved === 1,
    revision: row.revision,
    mentionedTeammateId: row.mentioned_teammate_id,
    taskId: row.task_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class DocumentCommentRepository extends BaseRepository {
  async list(
    outputId: string,
    userId: number,
    after?: string,
  ): Promise<{ comments: DocumentComment[]; nextCursor: string | null }> {
    if (after && !(await this.get(outputId, after, userId))) {
      throw new AssistantError("Comment cursor not found", ErrorType.PARAMS_ERROR, 400);
    }

    const rows = await this.runQuery<DocumentCommentRow>(
      `SELECT * FROM document_comment WHERE output_id = ? AND
       (? IS NULL OR (created_at, id) > (SELECT created_at, id FROM document_comment WHERE output_id = ? AND id = ?))
       AND ${COMMENT_READ_GUARD} ORDER BY created_at, id LIMIT 101`,
      [outputId, after ?? null, outputId, after ?? null, userId, userId],
    );
    const comments = rows.slice(0, 100).map(formatComment);

    return { comments, nextCursor: rows.length > 100 ? (comments.at(-1)?.id ?? null) : null };
  }

  async get(outputId: string, commentId: string, userId: number): Promise<DocumentComment | null> {
    const row = await this.runQuery<DocumentCommentRow>(
      `SELECT * FROM document_comment WHERE output_id = ? AND id = ? AND ${COMMENT_READ_GUARD}`,
      [outputId, commentId, userId, userId],
      true,
    );

    return row ? formatComment(row) : null;
  }

  async create(
    comment: DocumentComment,
    effects: D1PreparedStatement[] = [],
  ): Promise<DocumentComment> {
    const statement = this.env.DB.prepare(
      `INSERT INTO document_comment
       (id, output_id, parent_id, anchor_json, source_revision, body, author_user_id,
        resolved, revision, mentioned_teammate_id, task_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?) RETURNING *`,
    ).bind(
      comment.id,
      comment.outputId,
      comment.parentId,
      comment.anchor ? JSON.stringify(comment.anchor) : null,
      comment.sourceRevision,
      comment.body,
      comment.authorUserId,
      comment.mentionedTeammateId,
      comment.taskId,
      comment.createdAt,
    );

    try {
      const results = await this.executeBatch<DocumentCommentRow>([...effects, statement]);
      const row = results.at(-1)?.results[0];

      if (!row) {
        throw new AssistantError("Could not save the comment", ErrorType.DATABASE_ERROR);
      }

      return formatComment(row);
    } catch (error) {
      const message = getErrorMessage(error);

      if (message.includes("document_access_revoked")) {
        throw new AssistantError("Document access was revoked", ErrorType.FORBIDDEN, 403);
      }

      if (
        message.includes("document_revision_conflict") ||
        message.includes("document_thread_conflict")
      ) {
        throw new AssistantError(
          "The document or thread has changed. Refresh and try again.",
          ErrorType.CONFLICT_ERROR,
          409,
        );
      }

      throw error;
    }
  }

  async resolve(
    outputId: string,
    commentId: string,
    revision: number,
    resolved: boolean,
    userId: number,
  ): Promise<DocumentComment> {
    const row = await this.runQuery<DocumentCommentRow>(
      `UPDATE document_comment SET resolved = ?, revision = revision + 1, updated_at = ?
       WHERE output_id = ? AND id = ? AND parent_id IS NULL AND revision = ? AND ${COMMENT_READ_GUARD}
       AND (author_user_id = ? OR EXISTS (SELECT 1 FROM output JOIN project ON project.id = output.project_id
         JOIN workspace_member ON workspace_member.workspace_id = project.workspace_id
         WHERE output.id = document_comment.output_id AND workspace_member.user_id = ? AND workspace_member.role IN ('owner', 'admin')))
       RETURNING *`,
      [
        resolved ? 1 : 0,
        new Date().toISOString(),
        outputId,
        commentId,
        revision,
        userId,
        userId,
        userId,
        userId,
      ],
      true,
    );

    if (!row) {
      throw new AssistantError(
        "The thread has changed. Refresh and try again.",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    return formatComment(row);
  }
}
