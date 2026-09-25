import { generateId } from "@ngriffin_uk/polychat-utility-server/id";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { ProjectEnvironmentVariableRow } from "~/infrastructure/database/schema";
import { openSecret, sealSecret } from "~/infrastructure/secret-envelope";

export interface ProjectEnvironmentVariableMetadata {
  name: string;
  isSet: true;
  updatedAt: string;
}

export class ProjectEnvironmentVariableRepository extends BaseRepository {
  async list(projectId: string): Promise<ProjectEnvironmentVariableMetadata[]> {
    const rows = await this.runQuery<Pick<ProjectEnvironmentVariableRow, "name" | "updated_at">>(
      `SELECT name, updated_at FROM project_environment_variable
       WHERE project_id = ? ORDER BY name ASC`,
      [projectId],
    );

    return rows.map((row) => ({ name: row.name, isSet: true, updatedAt: row.updated_at ?? "" }));
  }

  async values(projectId: string, names: readonly string[]): Promise<Record<string, string>> {
    if (names.length === 0) {
      return {};
    }

    const placeholders = names.map(() => "?").join(", ");
    const rows = await this.runQuery<
      Pick<ProjectEnvironmentVariableRow, "name" | "encrypted_value">
    >(
      `SELECT name, encrypted_value FROM project_environment_variable
       WHERE project_id = ? AND name IN (${placeholders})`,
      [projectId, ...names],
    );
    const values: Record<string, string> = {};

    for (const row of rows) {
      values[row.name] = await openSecret(this.env, row.encrypted_value);
    }

    return values;
  }

  async set(projectId: string, name: string, value: string): Promise<void> {
    const encryptedValue = await sealSecret(this.env, value);

    await this.executeRun(
      `INSERT INTO project_environment_variable
       (id, project_id, name, encrypted_value)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(project_id, name) DO UPDATE SET
         encrypted_value = excluded.encrypted_value,
         updated_at = CURRENT_TIMESTAMP`,
      [generateId(), projectId, name, encryptedValue],
    );
  }

  async clear(projectId: string, name: string): Promise<boolean> {
    const result = await this.executeRun(
      "DELETE FROM project_environment_variable WHERE project_id = ? AND name = ?",
      [projectId, name],
    );

    return result.meta.changes > 0;
  }
}
