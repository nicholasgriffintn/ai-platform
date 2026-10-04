import { integrationSnapshotSchema, type IntegrationSnapshot } from "@ngriffin_uk/polychat-schemas";
import { generateId, generatePrefixedId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";

interface IntegrationDefinitionRow {
  id: string;
  user_id: number;
  workspace_id: string | null;
  name: string;
  description: string;
  revision: number;
  revoked_at: string | null;
  created_at: string;
  snapshot: string;
}

export interface StoredIntegrationDefinition {
  id: string;
  userId: number;
  workspaceId: string | null;
  name: string;
  description: string;
  revision: number;
  revoked: boolean;
  createdAt: string;
  snapshot: IntegrationSnapshot;
}

const DEFINITION_SELECT = `SELECT d.*, r.snapshot FROM integration_definition d
  JOIN integration_definition_revision r ON r.definition_id = d.id AND r.revision = d.revision`;

function formatDefinition(row: IntegrationDefinitionRow): StoredIntegrationDefinition {
  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    revision: row.revision,
    revoked: row.revoked_at !== null,
    createdAt: row.created_at,
    snapshot: integrationSnapshotSchema.parse(safeParseJson(row.snapshot)),
  };
}

export class IntegrationDefinitionRepository extends BaseRepository {
  async upsertPersonalConnection(input: {
    userId: number;
    definitionId: string;
    encryptedData: Record<string, unknown>;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    const stored = await this.runQuery<{ id: string }>(
      `INSERT INTO provider_connection (id, user_id, provider, kind, encrypted_data, metadata)
       SELECT ?, ?, d.id, 'native_mcp', ?, ? FROM integration_definition d
       WHERE d.id = ? AND d.revoked_at IS NULL
         AND ((d.workspace_id IS NULL AND d.user_id = ?)
           OR (d.workspace_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM workspace_member m WHERE m.workspace_id = d.workspace_id AND m.user_id = ?
           )))
       ON CONFLICT (user_id, provider, kind, external_id) DO UPDATE
         SET encrypted_data = excluded.encrypted_data, metadata = excluded.metadata,
             status = 'connected', updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        generateId(),
        input.userId,
        JSON.stringify(input.encryptedData),
        JSON.stringify(input.metadata),
        input.definitionId,
        input.userId,
        input.userId,
      ],
      true,
    );

    if (!stored) {
      throw new AssistantError(
        "The integration is no longer available for account connections",
        ErrorType.AUTHORISATION_ERROR,
        403,
      );
    }
  }

  async list(
    scope: { userId: number } | { workspaceId: string },
  ): Promise<StoredIntegrationDefinition[]> {
    const condition =
      "workspaceId" in scope ? "d.workspace_id = ?" : "d.workspace_id IS NULL AND d.user_id = ?";
    const rows = await this.runQuery<IntegrationDefinitionRow>(
      `${DEFINITION_SELECT} WHERE ${condition} AND d.revoked_at IS NULL ORDER BY d.name, d.id`,
      ["workspaceId" in scope ? scope.workspaceId : scope.userId],
    );

    return rows.map(formatDefinition);
  }

  async get(id: string): Promise<StoredIntegrationDefinition | null> {
    const row = await this.runQuery<IntegrationDefinitionRow>(
      `${DEFINITION_SELECT} WHERE d.id = ?`,
      [id],
      true,
    );

    return row ? formatDefinition(row) : null;
  }

  async getSnapshot(id: string, revision: number): Promise<IntegrationSnapshot | null> {
    const row = await this.runQuery<{ snapshot: string }>(
      "SELECT snapshot FROM integration_definition_revision WHERE definition_id = ? AND revision = ?",
      [id, revision],
      true,
    );

    return row ? integrationSnapshotSchema.parse(safeParseJson(row.snapshot)) : null;
  }

  async create(input: {
    userId: number;
    workspaceId?: string;
    name: string;
    description: string;
    snapshot: IntegrationSnapshot;
  }): Promise<StoredIntegrationDefinition> {
    const id = generatePrefixedId("mcp_");

    await this.executeBatch([
      this.env.DB.prepare(
        "INSERT INTO integration_definition (id, user_id, workspace_id, name, description) VALUES (?, ?, ?, ?, ?)",
      ).bind(id, input.userId, input.workspaceId ?? null, input.name, input.description),
      this.env.DB.prepare(
        "INSERT INTO integration_definition_revision (definition_id, revision, snapshot) VALUES (?, 1, ?)",
      ).bind(id, JSON.stringify(input.snapshot)),
    ]);
    const definition = await this.get(id);

    if (!definition) {
      throw new AssistantError("Failed to create integration", ErrorType.DATABASE_ERROR, 500);
    }

    return definition;
  }

  async revise(input: {
    id: string;
    expectedRevision: number;
    snapshot: IntegrationSnapshot;
  }): Promise<StoredIntegrationDefinition> {
    const nextRevision = input.expectedRevision + 1;
    const results = await this.executeBatch([
      this.env.DB.prepare(
        `INSERT INTO integration_definition_revision (definition_id, revision, snapshot)
         SELECT id, ?, ? FROM integration_definition WHERE id = ? AND revision = ? AND revoked_at IS NULL`,
      ).bind(nextRevision, JSON.stringify(input.snapshot), input.id, input.expectedRevision),
      this.env.DB.prepare(
        `UPDATE integration_definition SET revision = ? WHERE id = ? AND revision = ? AND revoked_at IS NULL
         AND EXISTS (SELECT 1 FROM integration_definition_revision WHERE definition_id = ? AND revision = ?)`,
      ).bind(nextRevision, input.id, input.expectedRevision, input.id, nextRevision),
    ]);

    if (!results[1]?.meta.changes) {
      throw new AssistantError(
        "Integration changed during review; refresh and try again",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    const definition = await this.get(input.id);

    if (!definition) {
      throw new AssistantError("Integration not found", ErrorType.NOT_FOUND, 404);
    }

    return definition;
  }

  async revoke(id: string): Promise<void> {
    await this.executeBatch([
      this.env.DB.prepare(
        "UPDATE integration_definition SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
      ).bind(new Date().toISOString(), id),
      this.env.DB.prepare(
        "DELETE FROM provider_connection WHERE provider = ? AND kind = 'native_mcp'",
      ).bind(id),
    ]);
  }
}
