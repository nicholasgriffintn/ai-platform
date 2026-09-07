import { decodeBase64 } from "hono/utils/encode";

import type { ProjectEnvironmentVariableRow } from "~/lib/database/schema";
import { bufferToBase64 } from "~/utils/base64";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { safeParseJson } from "~/utils/json";

import { BaseRepository } from "./BaseRepository";

export interface ProjectEnvironmentVariableMetadata {
  name: string;
  isSet: true;
  updatedAt: string;
}

export class ProjectEnvironmentVariableRepository extends BaseRepository {
  private async encryptionKey(): Promise<CryptoKey> {
    if (!this.env.PRIVATE_KEY) {
      throw new AssistantError("Server key not configured", ErrorType.CONFIGURATION_ERROR);
    }

    return crypto.subtle.importKey(
      "raw",
      decodeBase64(this.env.PRIVATE_KEY),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
  }

  private async encrypt(value: string): Promise<string> {
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        await this.encryptionKey(),
        new TextEncoder().encode(value),
      );

      return JSON.stringify({
        iv: bufferToBase64(iv),
        data: bufferToBase64(new Uint8Array(encrypted)),
      });
    } catch {
      throw new AssistantError("Failed to encrypt environment variable", ErrorType.UNKNOWN_ERROR);
    }
  }

  private async decrypt(envelope: string): Promise<string> {
    try {
      const parsed = safeParseJson<{ iv?: string; data?: string }>(envelope);

      if (!parsed?.iv || !parsed.data) {
        throw new Error("Invalid encrypted environment variable");
      }

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: decodeBase64(parsed.iv) },
        await this.encryptionKey(),
        decodeBase64(parsed.data),
      );

      return new TextDecoder().decode(decrypted);
    } catch {
      throw new AssistantError("Failed to decrypt environment variable", ErrorType.UNKNOWN_ERROR);
    }
  }

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
      values[row.name] = await this.decrypt(row.encrypted_value);
    }

    return values;
  }

  async set(projectId: string, name: string, value: string): Promise<void> {
    const encryptedValue = await this.encrypt(value);

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
