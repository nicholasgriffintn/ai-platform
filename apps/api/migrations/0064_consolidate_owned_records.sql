CREATE TABLE __owned_record_migration_guard (valid integer NOT NULL CHECK (valid = 1));
--> statement-breakpoint
INSERT INTO __owned_record_migration_guard
SELECT NOT EXISTS (
  SELECT 1 FROM model_dataset_profile p
  LEFT JOIN model_asset_version v ON v.id = p.version_id
  LEFT JOIN model_asset a ON a.id = v.asset_id
  WHERE v.id IS NULL OR p.workspace_id != v.workspace_id OR p.workspace_id != a.workspace_id
) AND NOT EXISTS (
  SELECT 1 FROM source_collection s JOIN conversation_group g ON s.id = g.id
) AND NOT EXISTS (
  SELECT 1 FROM mobile_auth_exchange_code c JOIN session s ON s.id = c.session_id
  WHERE c.user_id != s.user_id
);
--> statement-breakpoint
CREATE TABLE authentication_token (
  purpose text NOT NULL,
  token_hash text NOT NULL,
  provider text,
  kind text,
  payload text,
  oauth_data text,
  session_id text REFERENCES session(id) ON DELETE CASCADE,
  binding_id text REFERENCES channel_binding(id) ON DELETE CASCADE,
  user_id integer REFERENCES user(id) ON DELETE CASCADE,
  consumed_at text,
  created_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
  expires_at text NOT NULL,
  attempts integer DEFAULT 0 NOT NULL,
  PRIMARY KEY (purpose, token_hash),
  CONSTRAINT authentication_token_purpose_check CHECK (
    (purpose = 'oauth_state' AND provider IS NOT NULL AND oauth_data IS NOT NULL AND kind IS NULL AND payload IS NULL AND session_id IS NULL AND binding_id IS NULL AND user_id IS NULL AND consumed_at IS NULL)
    OR (purpose = 'challenge' AND provider IS NOT NULL AND kind IS NOT NULL AND payload IS NOT NULL AND oauth_data IS NULL AND session_id IS NULL AND binding_id IS NULL AND user_id IS NULL AND consumed_at IS NULL)
    OR (purpose = 'native_exchange' AND session_id IS NOT NULL AND user_id IS NOT NULL AND consumed_at IS NOT NULL AND binding_id IS NULL AND provider IS NULL AND kind IS NULL AND payload IS NULL AND oauth_data IS NULL)
    OR (purpose = 'channel_pairing' AND binding_id IS NOT NULL AND user_id IS NOT NULL AND session_id IS NULL AND provider IS NULL AND kind IS NULL AND payload IS NULL AND oauth_data IS NULL AND consumed_at IS NULL)
  )
);
--> statement-breakpoint
CREATE INDEX authentication_token_expires_at_idx ON authentication_token(purpose, expires_at);
--> statement-breakpoint
CREATE INDEX authentication_token_session_idx ON authentication_token(session_id);
--> statement-breakpoint
CREATE INDEX authentication_token_user_idx ON authentication_token(user_id);
--> statement-breakpoint
CREATE UNIQUE INDEX authentication_token_pairing_owner_idx ON authentication_token(binding_id, user_id) WHERE purpose = 'channel_pairing';
--> statement-breakpoint
INSERT INTO authentication_token (purpose, token_hash, provider, oauth_data, created_at, expires_at)
SELECT 'oauth_state', state_hash, provider,
  CASE WHEN context IS NULL THEN
    json_patch('{}', json_object('codeVerifier', code_verifier, 'nonce', nonce, 'redirectUri', redirect_uri))
  ELSE json_set(
    json_patch('{}', json_object('codeVerifier', code_verifier, 'nonce', nonce, 'redirectUri', redirect_uri)),
    '$.context', json(context)
  ) END,
  created_at, expires_at FROM oauth_state;
--> statement-breakpoint
INSERT INTO authentication_token (purpose, token_hash, provider, kind, payload, created_at, expires_at, attempts)
SELECT 'challenge', token_hash, provider, kind, payload, created_at, expires_at, attempts FROM auth_challenge;
--> statement-breakpoint
INSERT INTO authentication_token (purpose, token_hash, session_id, user_id, expires_at, consumed_at, created_at)
SELECT 'native_exchange', jti, session_id, user_id, expires_at, consumed_at, consumed_at FROM mobile_auth_exchange_code;
--> statement-breakpoint
INSERT INTO authentication_token (purpose, token_hash, binding_id, user_id, expires_at)
SELECT 'channel_pairing', token_hash, binding_id, user_id, expires_at FROM channel_pairing_challenge;
--> statement-breakpoint
CREATE TABLE inference_setting (
  kind text NOT NULL,
  id text NOT NULL,
  user_id integer NOT NULL REFERENCES user(id),
  target_id text,
  enabled integer,
  api_key text,
  created_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
  updated_at text DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (kind, id),
  CONSTRAINT inference_setting_kind_check CHECK (kind IN ('provider', 'model') AND (kind != 'provider' OR target_id IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX inference_setting_user_target_idx ON inference_setting(user_id, kind, target_id);
--> statement-breakpoint
CREATE INDEX inference_setting_target_idx ON inference_setting(kind, target_id);
--> statement-breakpoint
INSERT INTO inference_setting (kind, id, user_id, target_id, enabled, api_key, created_at, updated_at)
SELECT 'provider', id, user_id, provider_id, enabled, api_key, created_at, updated_at FROM provider_settings;
--> statement-breakpoint
INSERT INTO inference_setting (kind, id, user_id, target_id, enabled, api_key, created_at, updated_at)
SELECT 'model', id, user_id, model_id, enabled, api_key, created_at, updated_at FROM model_settings;
--> statement-breakpoint
ALTER TABLE user ADD COLUMN task_notification_preferences text;
--> statement-breakpoint
UPDATE user SET task_notification_preferences = (
  SELECT json_object(
    'enabled', json(CASE enabled WHEN 1 THEN 'true' ELSE 'false' END),
    'decisions', json(CASE decisions WHEN 1 THEN 'true' ELSE 'false' END),
    'failures', json(CASE failures WHEN 1 THEN 'true' ELSE 'false' END),
    'completions', json(CASE completions WHEN 1 THEN 'true' ELSE 'false' END),
    'assignments', json(CASE assignments WHEN 1 THEN 'true' ELSE 'false' END),
    'updated_at', updated_at
  ) FROM task_notification_preference WHERE user_id = user.id
) WHERE EXISTS (SELECT 1 FROM task_notification_preference WHERE user_id = user.id);
--> statement-breakpoint
ALTER TABLE workspace ADD COLUMN model_permissions text;
--> statement-breakpoint
ALTER TABLE workspace ADD COLUMN model_permissions_updated_by integer REFERENCES user(id) ON DELETE SET NULL;
--> statement-breakpoint
UPDATE workspace SET
  model_permissions = (SELECT json_object('grants', json(grants), 'separation_of_duties', json(CASE separation_of_duties WHEN 1 THEN 'true' ELSE 'false' END), 'updated_at', updated_at) FROM model_permission WHERE workspace_id = workspace.id),
  model_permissions_updated_by = (SELECT updated_by FROM model_permission WHERE workspace_id = workspace.id)
WHERE EXISTS (SELECT 1 FROM model_permission WHERE workspace_id = workspace.id);
--> statement-breakpoint
ALTER TABLE model_asset_version ADD COLUMN dataset_profile text;
--> statement-breakpoint
UPDATE model_asset_version SET dataset_profile = (
  SELECT json_object('status', status, 'shape', shape, 'mapping', json(mapping),
    'governance', json(governance), 'collection_method', collection_method, 'source_ref', source_ref,
    'request', json(request), 'stats', json(stats), 'failure_reason', failure_reason,
    'processed_at', processed_at, 'created_at', created_at)
  FROM model_dataset_profile WHERE version_id = model_asset_version.id
) WHERE EXISTS (SELECT 1 FROM model_dataset_profile WHERE version_id = model_asset_version.id);
--> statement-breakpoint
ALTER TABLE source_collection RENAME TO resource_collection;
--> statement-breakpoint
ALTER TABLE resource_collection ADD COLUMN owner_user_id integer REFERENCES user(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE resource_collection ADD COLUMN normalised_name text;
--> statement-breakpoint
ALTER TABLE resource_collection ADD COLUMN collection_type text DEFAULT 'source' NOT NULL
  CONSTRAINT resource_collection_scope_check CHECK (
    (collection_type = 'source' AND owner_user_id IS NULL)
    OR (collection_type = 'conversation' AND normalised_name IS NOT NULL AND ((owner_user_id IS NULL) <> (project_id IS NULL)))
  );
--> statement-breakpoint
DROP INDEX source_collection_created_by_user_id_idx;
--> statement-breakpoint
DROP INDEX source_collection_project_id_idx;
--> statement-breakpoint
CREATE INDEX resource_collection_creator_idx ON resource_collection(collection_type, created_by_user_id);
--> statement-breakpoint
CREATE INDEX resource_collection_project_idx ON resource_collection(collection_type, project_id);
--> statement-breakpoint
CREATE UNIQUE INDEX resource_collection_personal_group_name_idx ON resource_collection(owner_user_id, normalised_name) WHERE collection_type = 'conversation' AND owner_user_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX resource_collection_project_group_name_idx ON resource_collection(project_id, normalised_name) WHERE collection_type = 'conversation' AND project_id IS NOT NULL;
--> statement-breakpoint
INSERT INTO resource_collection (id, collection_type, created_by_user_id, owner_user_id, project_id, title, normalised_name, created_at, updated_at)
SELECT id, 'conversation', created_by_user_id, owner_user_id, project_id, name, normalised_name, created_at, created_at FROM conversation_group;
--> statement-breakpoint
ALTER TABLE conversation ADD COLUMN group_id text REFERENCES resource_collection(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE conversation ADD COLUMN group_assigned_by_user_id integer REFERENCES user(id);
--> statement-breakpoint
ALTER TABLE conversation ADD COLUMN group_assigned_at text;
--> statement-breakpoint
CREATE INDEX conversation_group_idx ON conversation(group_id);
--> statement-breakpoint
UPDATE conversation SET
  group_id = (SELECT group_id FROM conversation_group_membership WHERE conversation_id = conversation.id),
  group_assigned_by_user_id = (SELECT assigned_by_user_id FROM conversation_group_membership WHERE conversation_id = conversation.id),
  group_assigned_at = (SELECT created_at FROM conversation_group_membership WHERE conversation_id = conversation.id)
WHERE EXISTS (SELECT 1 FROM conversation_group_membership WHERE conversation_id = conversation.id);
--> statement-breakpoint
INSERT INTO __owned_record_migration_guard SELECT
  (SELECT COUNT(*) FROM authentication_token) = ((SELECT COUNT(*) FROM oauth_state) + (SELECT COUNT(*) FROM auth_challenge) + (SELECT COUNT(*) FROM mobile_auth_exchange_code) + (SELECT COUNT(*) FROM channel_pairing_challenge))
  AND (SELECT COUNT(*) FROM inference_setting) = ((SELECT COUNT(*) FROM provider_settings) + (SELECT COUNT(*) FROM model_settings))
  AND (SELECT COUNT(*) FROM user WHERE task_notification_preferences IS NOT NULL) = (SELECT COUNT(*) FROM task_notification_preference)
  AND (SELECT COUNT(*) FROM workspace WHERE model_permissions IS NOT NULL) = (SELECT COUNT(*) FROM model_permission)
  AND (SELECT COUNT(*) FROM model_asset_version WHERE dataset_profile IS NOT NULL) = (SELECT COUNT(*) FROM model_dataset_profile)
  AND (SELECT COUNT(*) FROM resource_collection WHERE collection_type = 'conversation') = (SELECT COUNT(*) FROM conversation_group)
  AND (SELECT COUNT(*) FROM conversation WHERE group_id IS NOT NULL) = (SELECT COUNT(*) FROM conversation_group_membership);
--> statement-breakpoint
DROP TABLE conversation_group_membership;
--> statement-breakpoint
DROP TABLE conversation_group;
--> statement-breakpoint
DROP TABLE oauth_state;
--> statement-breakpoint
DROP TABLE auth_challenge;
--> statement-breakpoint
DROP TABLE mobile_auth_exchange_code;
--> statement-breakpoint
DROP TABLE channel_pairing_challenge;
--> statement-breakpoint
DROP TABLE provider_settings;
--> statement-breakpoint
DROP TABLE model_settings;
--> statement-breakpoint
DROP TABLE task_notification_preference;
--> statement-breakpoint
DROP TABLE model_permission;
--> statement-breakpoint
DROP TABLE model_dataset_profile;
--> statement-breakpoint
DROP TABLE __owned_record_migration_guard;
