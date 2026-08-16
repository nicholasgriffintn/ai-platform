import type { AssistantCapabilityKind, ProjectCapabilityKind } from "@ngriffin_uk/polychat-schemas";

import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { parseJsonRecord } from "~/utils/json";
import { BaseRepository } from "./BaseRepository";

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

interface CapabilityConfigurationUpsertCondition {
	sql: string;
	values: unknown[];
}

function createCapabilityConfigurationUpsert(
	params: SaveCapabilityConfigurationParams,
	condition?: CapabilityConfigurationUpsertCondition,
): { query: string; values: unknown[] } {
	const values: unknown[] = [
		generateId(),
		params.scope.type,
		String(params.scope.id),
		params.capabilityKind,
		params.capabilityId,
		JSON.stringify(params.configuration),
	];
	const insertSource = condition
		? `SELECT ?, ?, ?, ?, ?, ? WHERE ${condition.sql}`
		: "VALUES (?, ?, ?, ?, ?, ?)";
	if (condition) values.push(...condition.values);

	return {
		query: `INSERT INTO capability_configuration
			(id, scope_type, scope_id, capability_kind, capability_id, configuration)
		 ${insertSource}
		 ON CONFLICT(scope_type, scope_id, capability_kind, capability_id) DO UPDATE SET
			configuration = excluded.configuration,
			updated_at = CURRENT_TIMESTAMP
		 RETURNING *`,
		values,
	};
}

export function buildCapabilityConfigurationUpsert(params: SaveCapabilityConfigurationParams): {
	query: string;
	values: unknown[];
} {
	return createCapabilityConfigurationUpsert(params);
}

export function buildConditionalCapabilityConfigurationUpsert(
	params: SaveCapabilityConfigurationParams,
	condition: CapabilityConfigurationUpsertCondition,
): { query: string; values: unknown[] } {
	return createCapabilityConfigurationUpsert(params, condition);
}

function formatScope(row: CapabilityConfigurationRow): CapabilityConfigurationScope {
	if (row.scope_type === "project" && row.scope_id) {
		return { type: "project", id: row.scope_id };
	}
	if (row.scope_type === "user") {
		const userId = Number(row.scope_id);
		if (Number.isSafeInteger(userId) && userId > 0) return { type: "user", id: userId };
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
		const conditions: Record<string, unknown> = {
			scope_type: scope.type,
			scope_id: String(scope.id),
		};
		if (capabilityKind) conditions.capability_kind = capabilityKind;
		const { query, values } = this.buildSelectQuery("capability_configuration", conditions, {
			orderBy: "created_at ASC",
		});
		const rows = await this.runQuery<CapabilityConfigurationRow>(query, values);
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
