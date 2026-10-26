export function sourceVisibilitySql(alias: string): string {
  return `(${alias}.connection_id IS NULL OR EXISTS (
    SELECT 1 FROM provider_connection connection WHERE connection.id = ${alias}.connection_id
      AND connection.status = 'connected' AND connection.user_id = ${alias}.created_by_user_id
  )) AND (json_type(${alias}.metadata, '$.syncId') IS NOT 'text' OR EXISTS (
    SELECT 1 FROM source_knowledge_sync ss
    WHERE ss.id = json_extract(${alias}.metadata, '$.syncId') AND ss.status = 'active'
      AND ss.user_id = ${alias}.created_by_user_id AND ss.connection_id = ${alias}.connection_id
      AND ((ss.project_id IS NOT NULL AND ss.project_id = ${alias}.project_id
          AND EXISTS (SELECT 1 FROM project p JOIN resource_grant publisher ON publisher.kind = 'membership'
            AND publisher.workspace_id = p.workspace_id AND publisher.user_id = ss.user_id
            AND publisher.role IN ('owner', 'admin') WHERE p.id = ss.project_id)
          AND EXISTS (SELECT 1 FROM scoped_configuration grant_row WHERE grant_row.kind = 'capability' AND grant_row.attached = 1 AND grant_row.project_id = ss.project_id
            AND grant_row.target_kind = 'recipe' AND grant_row.target_id = ss.recipe_id AND grant_row.excluded = 0))
        OR (ss.project_id IS NULL AND ${alias}.project_id IS NULL AND ss.collection_id IS NOT NULL))
  ))`;
}
