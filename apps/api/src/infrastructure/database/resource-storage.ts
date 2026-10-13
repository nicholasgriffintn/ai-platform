export const sourceResourceColumns =
  "id, created_by_user_id, project_id, conversation_id, connection_id, kind, title, status, content, provider, external_uri, vector_id, metadata, storage_key, mime_type, filename, byte_size, created_at, updated_at, search_revision";

export const sourceResourceSql = `(SELECT ${sourceResourceColumns} FROM resource WHERE resource_type = 'source')`;

export const outputResourceColumns =
  "id, created_by_user_id, project_id, conversation_id, parent_output_id, capability_id, group_id, kind, title, status, sensitivity, content, storage_key, mime_type, filename, byte_size, revision, created_at, updated_at, provenance_json, revision_created_by_user_id, revision_created_at, revision_operation, restored_from_revision";

export const outputResourceSql = `(SELECT ${outputResourceColumns} FROM resource WHERE resource_type = 'output')`;

export const memoryResourceColumns =
  "id, scope_type, scope_id, title AS name, content, revision, created_by_user_id AS created_by, deleted_at, created_at, updated_at, kind";

export const memoryResourceSql = `(SELECT ${memoryResourceColumns} FROM resource WHERE resource_type = 'memory')`;

export const skillResourceColumns =
  "id, scope_type, scope_id, title AS name, created_by_user_id AS created_by, draft_revision_id, stable_revision_id, state_version, archived_at, created_at, updated_at";

export const skillResourceSql = `(SELECT ${skillResourceColumns} FROM resource WHERE resource_type = 'skill')`;

export const synthesisResourceColumns =
  "id, created_by_user_id AS user_id, content AS synthesis_text, revision AS synthesis_version, memory_ids, memory_count, tokens_used, namespace, is_active, superseded_by, created_at, updated_at";

export const synthesisResourceSql = `(SELECT ${synthesisResourceColumns} FROM resource WHERE resource_type = 'synthesis')`;

export function resourceScope(userId: number, projectId?: string | null) {
  return {
    scope_type: projectId ? "project" : "personal",
    scope_id: projectId ?? String(userId),
  };
}
