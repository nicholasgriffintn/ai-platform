import {
  documentCommentSchema,
  toListPage,
  type DocumentComment,
  type DocumentCommentSubject,
  type ListPage,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { outputResourceSql, sourceResourceSql } from "~/infrastructure/database/resource-storage";

const COMMENT_PAGE_SIZE = 100;

interface DocumentCommentRow {
  id: string;
  output_id: string | null;
  source_id: string | null;
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

const SUBJECTS = {
  output: { column: "output_id", resources: outputResourceSql },
  source: { column: "source_id", resources: sourceResourceSql },
} as const;

function readGuard(subject: DocumentCommentSubject): string {
  const { column, resources } = SUBJECTS[subject.type];

  return `EXISTS (SELECT 1 FROM ${resources} subject WHERE subject.id = document_comment.${column}
  AND ((subject.project_id IS NULL AND subject.created_by_user_id = ?) OR EXISTS
    (SELECT 1 FROM project JOIN resource_grant workspace_member ON workspace_member.kind = 'membership' AND workspace_member.workspace_id = project.workspace_id
      WHERE project.id = subject.project_id AND workspace_member.user_id = ?)))`;
}

function formatComment(row: DocumentCommentRow): DocumentComment {
  return documentCommentSchema.parse({
    id: row.id,
    outputId: row.output_id,
    sourceId: row.source_id,
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
    subject: DocumentCommentSubject,
    userId: number,
    after?: string,
  ): Promise<ListPage<DocumentComment>> {
    if (after && !(await this.get(subject, after, userId))) {
      throw new AssistantError("Comment cursor not found", ErrorType.PARAMS_ERROR, 400);
    }

    const { column } = SUBJECTS[subject.type];
    const rows = await this.runQuery<DocumentCommentRow>(
      `SELECT * FROM document_comment WHERE ${column} = ? AND
       (? IS NULL OR (created_at, id) > (SELECT created_at, id FROM document_comment WHERE ${column} = ? AND id = ?))
       AND ${readGuard(subject)} ORDER BY created_at, id LIMIT ${COMMENT_PAGE_SIZE + 1}`,
      [subject.id, after ?? null, subject.id, after ?? null, userId, userId],
    );

    return toListPage(rows.map(formatComment), COMMENT_PAGE_SIZE, (comment) => comment.id);
  }

  async get(
    subject: DocumentCommentSubject,
    commentId: string,
    userId: number,
  ): Promise<DocumentComment | null> {
    const row = await this.runQuery<DocumentCommentRow>(
      `SELECT * FROM document_comment WHERE ${SUBJECTS[subject.type].column} = ? AND id = ? AND ${readGuard(subject)}`,
      [subject.id, commentId, userId, userId],
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
       (id, output_id, source_id, parent_id, anchor_json, source_revision, body, author_user_id,
        resolved, revision, mentioned_teammate_id, task_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?) RETURNING *`,
    ).bind(
      comment.id,
      comment.outputId,
      comment.sourceId,
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
    subject: DocumentCommentSubject,
    commentId: string,
    revision: number,
    resolved: boolean,
    userId: number,
  ): Promise<DocumentComment> {
    const { column, resources } = SUBJECTS[subject.type];
    const row = await this.runQuery<DocumentCommentRow>(
      `UPDATE document_comment SET resolved = ?, revision = revision + 1, updated_at = ?
       WHERE ${column} = ? AND id = ? AND parent_id IS NULL AND revision = ? AND ${readGuard(subject)}
       AND (author_user_id = ? OR EXISTS (SELECT 1 FROM ${resources} subject JOIN project ON project.id = subject.project_id
         JOIN resource_grant workspace_member ON workspace_member.kind = 'membership' AND workspace_member.workspace_id = project.workspace_id
         WHERE subject.id = document_comment.${column} AND workspace_member.user_id = ? AND workspace_member.role IN ('owner', 'admin')))
       RETURNING *`,
      [
        resolved ? 1 : 0,
        new Date().toISOString(),
        subject.id,
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
