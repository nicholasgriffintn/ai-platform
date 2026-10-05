export function buildMembershipRemovalStatements(
  database: D1Database,
  workspaceId: string,
  userId: number,
  actorId: number,
) {
  const authority = `member.role IN ('admin', 'member') AND EXISTS (
    SELECT 1 FROM active_workspace_member actor JOIN user u ON u.id = actor.user_id
    WHERE actor.workspace_id = member.workspace_id AND actor.user_id = ? AND u.plan_id = 'pro'
      AND (actor.user_id = member.user_id OR actor.role = 'owner'
        OR (actor.role = 'admin' AND member.role = 'member'))
  )`;
  const contextIds = `SELECT tc.id FROM teammate_context tc
    JOIN project p ON tc.scope_type = 'project' AND tc.scope_id = p.id
    JOIN workspace_member member ON member.workspace_id = p.workspace_id AND member.user_id = tc.actor_user_id
    WHERE member.workspace_id = ? AND member.user_id = ? AND ${authority}`;
  const bindings = [workspaceId, userId, actorId];

  return [
    database
      .prepare(
        `UPDATE template SET status = 'paused',
        configuration = json_set(configuration, '$.status', 'paused'), updated_at = CURRENT_TIMESTAMP
       WHERE status = 'active' AND json_extract(configuration, '$.teammateContextId') IN (${contextIds})`,
      )
      .bind(...bindings),
    database
      .prepare(`DELETE FROM teammate_connection_grant WHERE context_id IN (${contextIds})`)
      .bind(...bindings),
    database
      .prepare(
        `UPDATE teammate_context SET status = 'archived', updated_at = CURRENT_TIMESTAMP
       WHERE id IN (${contextIds})`,
      )
      .bind(...bindings),
    database
      .prepare(
        `DELETE FROM workspace_member AS member
       WHERE member.workspace_id = ? AND member.user_id = ? AND ${authority} RETURNING user_id`,
      )
      .bind(...bindings),
  ];
}
