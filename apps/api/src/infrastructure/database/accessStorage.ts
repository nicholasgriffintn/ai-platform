export const WORKSPACE_INVITATION_COLUMNS = `id, workspace_id, email, role, token_hash,
  status, created_by_user_id AS invited_by, accepted_by, expires_at, accepted_at, created_at, updated_at`;

export const REVIEW_POLICY_COLUMNS = `r.id, r.workspace_id, r.project_id, r.owner_user_id,
  r.target_kind AS provider, r.connection_id, r.account_id, r.target_id AS repository,
  r.enabled, json_extract(r.payload, '$.token_budget') AS token_budget, r.revision`;
