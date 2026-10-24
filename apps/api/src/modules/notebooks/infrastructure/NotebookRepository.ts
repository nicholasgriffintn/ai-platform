import { BaseRepository } from "~/infrastructure/database/BaseRepository";

export interface NotebookRecord {
  id: string;
  owner_user_id: number | null;
  project_id: string | null;
  title: string;
  normalised_name: string;
  instructions: string | null;
  settings: string | null;
  guide: string | null;
  created_by_user_id: number;
  created_at: string;
  updated_at: string | null;
}

export interface NotebookConversationRecord {
  id: string;
  title: string | null;
  updated_at: string | null;
}

export interface NotebookChanges {
  title?: string;
  instructions?: string;
  settings?: Record<string, unknown>;
}

const NOTEBOOK_COLUMNS =
  "id, owner_user_id, project_id, title, normalised_name, instructions, settings, guide, created_by_user_id, created_at, updated_at";

export class NotebookRepository extends BaseRepository {
  async getNotebook(notebookId: string): Promise<NotebookRecord | null> {
    return this.runQuery<NotebookRecord>(
      `SELECT ${NOTEBOOK_COLUMNS} FROM resource_collection WHERE collection_type = 'conversation' AND id = ?`,
      [notebookId],
      true,
    );
  }

  async listPersonalNotebooks(userId: number): Promise<NotebookRecord[]> {
    return this.runQuery<NotebookRecord>(
      `SELECT ${NOTEBOOK_COLUMNS} FROM resource_collection
       WHERE collection_type = 'conversation' AND owner_user_id = ?
       ORDER BY normalised_name ASC, id ASC`,
      [userId],
    );
  }

  async listProjectNotebooks(projectId: string): Promise<NotebookRecord[]> {
    return this.runQuery<NotebookRecord>(
      `SELECT ${NOTEBOOK_COLUMNS} FROM resource_collection
       WHERE collection_type = 'conversation' AND project_id = ?
       ORDER BY normalised_name ASC, id ASC`,
      [projectId],
    );
  }

  async updateNotebook(notebookId: string, changes: NotebookChanges): Promise<boolean> {
    const assignments: string[] = [];
    const values: unknown[] = [];

    if (changes.title !== undefined) {
      assignments.push("title = ?", "normalised_name = ?");
      values.push(changes.title, changes.title.toLowerCase());
    }

    if (changes.instructions !== undefined) {
      assignments.push("instructions = ?");
      values.push(changes.instructions);
    }

    if (changes.settings !== undefined) {
      assignments.push("settings = ?");
      values.push(JSON.stringify(changes.settings));
    }

    if (assignments.length === 0) {
      return true;
    }

    const result = await this.executeRun(
      `UPDATE OR IGNORE resource_collection SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE collection_type = 'conversation' AND id = ?`,
      [...values, notebookId],
    );

    return result.meta.changes === 1;
  }

  async setGuide(notebookId: string, guide: Record<string, unknown>): Promise<void> {
    await this.executeRun(
      "UPDATE resource_collection SET guide = ?, updated_at = CURRENT_TIMESTAMP WHERE collection_type = 'conversation' AND id = ?",
      [JSON.stringify(guide), notebookId],
    );
  }

  async listConversations(notebook: NotebookRecord): Promise<NotebookConversationRecord[]> {
    const [scopeClause, scopeValue] = notebook.project_id
      ? ["project_id = ?", notebook.project_id]
      : ["project_id IS NULL AND user_id = ?", notebook.owner_user_id];

    return this.runQuery<NotebookConversationRecord>(
      `SELECT id, title, updated_at FROM conversation
       WHERE group_id = ? AND ${scopeClause} AND COALESCE(is_archived, 0) = 0
       ORDER BY updated_at DESC LIMIT 100`,
      [notebook.id, scopeValue],
    );
  }
}
