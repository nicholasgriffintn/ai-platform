import {
  buildConditionalCapabilityConfigurationUpsert,
  type SaveCapabilityConfigurationParams,
} from "./CapabilityConfigurationRepository";

export function buildOwnedProjectCapabilityConfigurationUpsert(
  params: SaveCapabilityConfigurationParams & {
    scope: { type: "project"; id: string };
    createdBy: number;
  },
): { query: string; values: unknown[] } {
  return buildConditionalCapabilityConfigurationUpsert(params, {
    sql: `EXISTS (
			SELECT 1 FROM project_capability
			WHERE project_id = ? AND kind = ? AND capability_id = ?
				AND (kind = 'tool' OR created_by = ?)
		)`,
    values: [params.scope.id, params.capabilityKind, params.capabilityId, params.createdBy],
  });
}
