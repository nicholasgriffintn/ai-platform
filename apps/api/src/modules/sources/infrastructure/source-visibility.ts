export function sourceVisibilitySql(alias: "s" | "source"): string {
  return `(${alias}.sync_id IS NULL OR EXISTS (
    SELECT 1 FROM source_sync ss JOIN provider_connection connection ON connection.id = ss.connection_id
    WHERE ss.id = ${alias}.sync_id AND ss.enabled = 1 AND connection.status = 'connected'
      AND ss.project_id IS ${alias}.project_id AND ss.created_by_user_id = ${alias}.created_by_user_id
      AND datetime(${alias}.permissions_valid_until) > datetime('now')
      AND ${alias}.status = 'available'
      AND (ss.project_id IS NULL OR (
        EXISTS (SELECT 1 FROM project p JOIN workspace_member m ON m.workspace_id = p.workspace_id
          WHERE p.id = ss.project_id AND m.user_id = ss.created_by_user_id AND m.role IN ('owner', 'admin'))
        AND (json_extract(${alias}.permission_grants, '$.public') = 1 OR NOT EXISTS (
          SELECT 1 FROM project p JOIN workspace_member m ON m.workspace_id = p.workspace_id JOIN user u ON u.id = m.user_id
          WHERE p.id = ss.project_id AND NOT EXISTS (
            SELECT 1 FROM json_each(${alias}.permission_grants, '$.emails') grant_email WHERE lower(grant_email.value) = lower(u.email)
          )
        ))
      ))
  ))`;
}
