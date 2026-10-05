import type { AssistantCapabilityKind, ProjectCapabilityKind } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";

const CAPABILITY_CONFIGURATION_COLUMNS = [
  "COALESCE(configuration_id, id) AS id",
  "scope_type",
  "scope_id",
  "target_kind AS capability_kind",
  "target_id AS capability_id",
  "payload AS configuration",
  "COALESCE(configuration_created_at, created_at) AS created_at",
  "updated_at",
];

export type CapabilityConfigurationScope =
  | { type: "user"; id: number }
  | { type: "project"; id: string };

export type CapabilityConfigurationKind = AssistantCapabilityKind | ProjectCapabilityKind;

export interface CapabilityConfigurationRow {
  id: string;
  scope_type: CapabilityConfigurationScope["type"];
  scope_id: string;
  capability_kind: CapabilityConfigurationKind;
  capability_id: string;
  configuration: string;
  created_at: string;
  updated_at: string | null;
}

export interface CapabilityConfigurationRecord {
  id: string;
  scope: CapabilityConfigurationScope;
  capabilityKind: CapabilityConfigurationKind;
  capabilityId: string;
  configuration: Record<string, unknown>;
  createdAt: string;
  updatedAt: string | null;
}

export interface SaveCapabilityConfigurationParams {
  scope: CapabilityConfigurationScope;
  capabilityKind: CapabilityConfigurationKind;
  capabilityId: string;
  configuration: Record<string, unknown>;
}

export interface CapabilityConfigurationInsertValues {
  id: string;
  user_id: number | null;
  project_id: string | null;
  target_kind: CapabilityConfigurationKind;
  target_id: string;
  payload: string;
}

export function buildCapabilityConfigurationValues(
  params: SaveCapabilityConfigurationParams,
): CapabilityConfigurationInsertValues {
  return {
    id: generateId(),
    user_id: params.scope.type === "user" ? params.scope.id : null,
    project_id: params.scope.type === "project" ? params.scope.id : null,
    target_kind: params.capabilityKind,
    target_id: params.capabilityId,
    payload: JSON.stringify(params.configuration),
  };
}

export function buildCapabilityConfigurationUpsert(params: SaveCapabilityConfigurationParams): {
  query: string;
  values: unknown[];
} {
  const insert = buildCapabilityConfigurationValues(params);
  const values: unknown[] = [
    insert.id,
    insert.user_id,
    insert.project_id,
    insert.target_kind,
    insert.target_id,
    insert.payload,
    insert.id,
  ];

  return {
    query: `INSERT INTO scoped_configuration
      (kind, id, user_id, project_id, target_kind, target_id, payload, configuration_id)
      VALUES ('capability', ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(scope_type, scope_id, target_kind, target_id) WHERE kind = 'capability' DO UPDATE SET
        payload = excluded.payload,
        configuration_id = COALESCE(scoped_configuration.configuration_id, excluded.configuration_id),
        updated_at = CURRENT_TIMESTAMP
      RETURNING ${CAPABILITY_CONFIGURATION_COLUMNS.join(", ")}`,
    values,
  };
}

function formatScope(row: CapabilityConfigurationRow): CapabilityConfigurationScope {
  if (row.scope_type === "project" && row.scope_id) {
    return { type: "project", id: row.scope_id };
  }

  if (row.scope_type === "user") {
    const userId = Number(row.scope_id);

    if (Number.isSafeInteger(userId) && userId > 0) {
      return { type: "user", id: userId };
    }
  }

  throw new AssistantError(
    "Stored capability configuration has an invalid scope",
    ErrorType.DATABASE_ERROR,
    500,
  );
}

function formatConfiguration(row: CapabilityConfigurationRow): CapabilityConfigurationRecord {
  return {
    id: row.id,
    scope: formatScope(row),
    capabilityKind: row.capability_kind,
    capabilityId: row.capability_id,
    configuration: parseJsonRecord(row.configuration),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CapabilityConfigurationRepository extends BaseRepository {
  async list(
    scope: CapabilityConfigurationScope,
    capabilityKind?: CapabilityConfigurationKind,
  ): Promise<CapabilityConfigurationRecord[]> {
    const rows = await this.runQuery<CapabilityConfigurationRow>(
      `SELECT ${CAPABILITY_CONFIGURATION_COLUMNS.join(", ")} FROM scoped_configuration
       WHERE kind = 'capability' AND scope_type = ? AND scope_id = ?${capabilityKind ? " AND target_kind = ?" : ""}
       ORDER BY created_at ASC`,
      [scope.type, String(scope.id), ...(capabilityKind ? [capabilityKind] : [])],
    );

    return rows.map(formatConfiguration);
  }

  async save(params: SaveCapabilityConfigurationParams): Promise<CapabilityConfigurationRecord> {
    const statement = buildCapabilityConfigurationUpsert(params);
    const row = await this.runQuery<CapabilityConfigurationRow>(
      statement.query,
      statement.values,
      true,
    );

    if (!row) {
      throw new AssistantError(
        "Failed to save capability configuration",
        ErrorType.DATABASE_ERROR,
        500,
      );
    }

    return formatConfiguration(row);
  }
}
