export const CHANNEL_MEMBER_GUARD = `(channel_binding.scope_type = 'personal' AND channel_binding.scope_id = CAST(CAST(? AS INTEGER) AS TEXT)) OR
  (channel_binding.scope_type = 'project' AND EXISTS (SELECT 1 FROM project JOIN workspace_member
    ON workspace_member.workspace_id = project.workspace_id WHERE project.id = channel_binding.scope_id AND workspace_member.user_id = ?))`;

export const CHANNEL_ADMIN_GUARD = `(channel_binding.scope_type = 'personal' AND channel_binding.scope_id = CAST(CAST(? AS INTEGER) AS TEXT)) OR
  (channel_binding.scope_type = 'project' AND EXISTS (SELECT 1 FROM project JOIN workspace_member
    ON workspace_member.workspace_id = project.workspace_id WHERE project.id = channel_binding.scope_id AND workspace_member.user_id = ?
    AND workspace_member.role IN ('owner', 'admin')))`;
