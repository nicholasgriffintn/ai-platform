import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { InitiativeRow } from "~/infrastructure/database/schema";

export class InitiativeRepository extends BaseRepository {
  async listForWorkspace(workspaceId: string): Promise<InitiativeRow[]> {
    return this.runQuery<InitiativeRow>(
      "SELECT * FROM initiative WHERE workspace_id = ? ORDER BY position ASC, created_at ASC",
      [workspaceId],
    );
  }

  async getById(initiativeId: string): Promise<InitiativeRow | null> {
    return this.runQuery<InitiativeRow>(
      "SELECT * FROM initiative WHERE id = ?",
      [initiativeId],
      true,
    );
  }

  async create(params: {
    workspaceId: string;
    name: string;
    description: string;
    status: InitiativeRow["status"];
    targetDate: string | null;
    ownerTeammateId: string | null;
  }): Promise<InitiativeRow> {
    const row = await this.runQuery<InitiativeRow>(
      `INSERT INTO initiative (id, workspace_id, name, description, status, target_date, owner_teammate_id, position)
       VALUES (?, ?, ?, ?, ?, ?, ?,
         COALESCE((SELECT MAX(position) FROM initiative WHERE workspace_id = ?), 0) + 1)
       RETURNING *`,
      [
        generateId(),
        params.workspaceId,
        params.name,
        params.description,
        params.status,
        params.targetDate,
        params.ownerTeammateId,
        params.workspaceId,
      ],
      true,
    );

    if (!row) {
      throw new Error("Failed to create the initiative");
    }

    return row;
  }

  async update(initiativeId: string, updates: Record<string, unknown>): Promise<void> {
    const result = this.buildUpdateQuery(
      "initiative",
      updates,
      ["name", "description", "status", "target_date", "owner_teammate_id"],
      "id = ?",
      [initiativeId],
    );

    if (result) {
      await this.executeRun(result.query, result.values);
    }
  }

  async delete(initiativeId: string): Promise<void> {
    await this.executeBatch([
      this.env.DB.prepare("UPDATE project SET initiative_id = NULL WHERE initiative_id = ?").bind(
        initiativeId,
      ),
      this.env.DB.prepare("DELETE FROM initiative WHERE id = ?").bind(initiativeId),
    ]);
  }

  async setProjects(
    workspaceId: string,
    initiativeId: string,
    projectIds: string[],
  ): Promise<void> {
    await this.executeBatch([
      this.env.DB.prepare(
        "UPDATE project SET initiative_id = NULL WHERE workspace_id = ? AND initiative_id = ?",
      ).bind(workspaceId, initiativeId),
      ...projectIds.map((projectId) =>
        this.env.DB.prepare(
          "UPDATE project SET initiative_id = ? WHERE workspace_id = ? AND id = ?",
        ).bind(initiativeId, workspaceId, projectId),
      ),
    ]);
  }

  async summariseProgress(
    workspaceId: string,
  ): Promise<{ project_id: string; done: number; total: number }[]> {
    return this.runQuery(
      `SELECT project_id,
              SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
              COUNT(*) AS total
       FROM project_task
       WHERE workspace_id = ? AND kind = 'task' AND status != 'cancelled'
       GROUP BY project_id`,
      [workspaceId],
    );
  }
}
