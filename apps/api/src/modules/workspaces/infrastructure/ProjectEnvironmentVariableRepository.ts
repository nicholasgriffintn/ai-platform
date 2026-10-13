import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { openSecret, sealSecret } from "~/infrastructure/secret-envelope";

export interface ProjectEnvironmentVariableMetadata {
  name: string;
  isSet: true;
  updatedAt: string;
}

export class ProjectEnvironmentVariableRepository extends BaseRepository {
  async list(projectId: string): Promise<ProjectEnvironmentVariableMetadata[]> {
    const rows = await this.runQuery<{ name: string; updated_at: string | null }>(
      `SELECT target_id AS name, updated_at FROM scoped_configuration
       WHERE kind = 'environment' AND project_id = ? ORDER BY target_id ASC`,
      [projectId],
    );

    return rows.map((row) => ({ name: row.name, isSet: true, updatedAt: row.updated_at ?? "" }));
  }

  async values(projectId: string, names: readonly string[]): Promise<Record<string, string>> {
    if (names.length === 0) {
      return {};
    }

    const placeholders = names.map(() => "?").join(", ");
    const rows = await this.runQuery<{ name: string; encrypted_value: string }>(
      `SELECT target_id AS name, encrypted_value FROM scoped_configuration
       WHERE kind = 'environment' AND project_id = ? AND target_id IN (${placeholders})`,
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
      `INSERT INTO scoped_configuration
       (kind, id, project_id, target_id, encrypted_value)
       VALUES ('environment', ?, ?, ?, ?)
       ON CONFLICT(project_id, target_id) WHERE kind = 'environment' DO UPDATE SET
         encrypted_value = excluded.encrypted_value,
         updated_at = CURRENT_TIMESTAMP`,
      [generateId(), projectId, name, encryptedValue],
    );
  }

  async clear(projectId: string, name: string): Promise<boolean> {
    const result = await this.executeRun(
      "DELETE FROM scoped_configuration WHERE kind = 'environment' AND project_id = ? AND target_id = ?",
      [projectId, name],
    );

    return result.meta.changes > 0;
  }
}
