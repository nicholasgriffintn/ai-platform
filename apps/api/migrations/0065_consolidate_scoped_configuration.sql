CREATE TABLE scoped_configuration (
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  user_id INTEGER REFERENCES user(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES project(id) ON DELETE CASCADE,
  scope_type TEXT GENERATED ALWAYS AS (CASE WHEN project_id IS NOT NULL THEN 'project' ELSE 'user' END),
  scope_id TEXT GENERATED ALWAYS AS (COALESCE(project_id, CAST(user_id AS TEXT))),
  target_kind TEXT NOT NULL DEFAULT '',
  target_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  encrypted_value TEXT,
  public_key TEXT,
  enabled INTEGER,
  attached INTEGER NOT NULL DEFAULT 0,
  excluded INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES user(id),
  configuration_id TEXT,
  configuration_created_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (kind, id),
  CONSTRAINT scoped_configuration_scope_check CHECK ((user_id IS NOT NULL) != (project_id IS NOT NULL)),
  CONSTRAINT scoped_configuration_kind_check CHECK (
    (kind IN ('preferences', 'provider', 'model') AND user_id IS NOT NULL AND (kind != 'provider' OR target_id IS NOT NULL))
    OR (kind = 'capability' AND target_id IS NOT NULL)
    OR (kind = 'environment' AND project_id IS NOT NULL AND target_id IS NOT NULL AND encrypted_value IS NOT NULL)
  ),
  CONSTRAINT scoped_configuration_attachment_check CHECK (attached = 0 OR (kind = 'capability' AND project_id IS NOT NULL AND created_by IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX scoped_configuration_user_target_idx ON scoped_configuration(user_id, kind, target_id);
--> statement-breakpoint
CREATE INDEX scoped_configuration_project_target_idx ON scoped_configuration(project_id, kind, target_kind, target_id);
--> statement-breakpoint
CREATE INDEX scoped_configuration_target_idx ON scoped_configuration(kind, target_kind, target_id);
--> statement-breakpoint
CREATE UNIQUE INDEX scoped_configuration_capability_idx ON scoped_configuration(scope_type, scope_id, target_kind, target_id) WHERE kind = 'capability';
--> statement-breakpoint
CREATE UNIQUE INDEX scoped_configuration_environment_idx ON scoped_configuration(project_id, target_id) WHERE kind = 'environment';
--> statement-breakpoint
INSERT INTO scoped_configuration (kind, id, user_id, payload, encrypted_value, public_key, created_at, updated_at)
SELECT 'preferences', id, user_id, json_object(
  'nickname', nickname,
  'job_role', job_role,
  'traits', traits,
  'preferences', preferences,
  'guardrails_enabled', guardrails_enabled,
  'guardrails_provider', guardrails_provider,
  'bedrock_guardrail_id', bedrock_guardrail_id,
  'bedrock_guardrail_version', bedrock_guardrail_version,
  'embedding_provider', embedding_provider,
  'bedrock_knowledge_base_id', bedrock_knowledge_base_id,
  'bedrock_knowledge_base_custom_data_source_id', bedrock_knowledge_base_custom_data_source_id,
  's3vectors_bucket_name', s3vectors_bucket_name,
  's3vectors_index_name', s3vectors_index_name,
  's3vectors_region', s3vectors_region,
  'dynamodb_vectors_table_name', dynamodb_vectors_table_name,
  'dynamodb_vectors_index_name', dynamodb_vectors_index_name,
  'dynamodb_vectors_region', dynamodb_vectors_region,
  'memories_save_enabled', memories_save_enabled,
  'memories_chat_history_enabled', memories_chat_history_enabled,
  'temporary_chats_default', temporary_chats_default,
  'memory_provider', memory_provider,
  'transcription_provider', transcription_provider,
  'transcription_model', transcription_model,
  'speech_provider', speech_provider,
  'speech_model', speech_model,
  'search_provider', search_provider,
  'sandbox_model', sandbox_model,
  'default_model_tier', default_model_tier,
  'default_model_id', default_model_id,
  'default_compute_site', default_compute_site,
  'last_model_selection', json(last_model_selection),
  'pet_source', pet_source,
  'pet_id', pet_id,
  'pet_travel_enabled', pet_travel_enabled,
  'pet_animation_enabled', pet_animation_enabled,
  'pet_model_overrides', json(pet_model_overrides),
  'onboarding_seen', json(onboarding_seen),
  'tracking_enabled', tracking_enabled,
  'advertise_machines', advertise_machines
), private_key, public_key, created_at, updated_at FROM user_settings;
--> statement-breakpoint
INSERT INTO scoped_configuration (kind, id, user_id, target_id, enabled, encrypted_value, created_at, updated_at)
SELECT kind, id, user_id, target_id, enabled, api_key, created_at, updated_at FROM inference_setting;
--> statement-breakpoint
INSERT INTO scoped_configuration (kind, id, project_id, target_kind, target_id, payload, attached, excluded, created_by, configuration_id, configuration_created_at, created_at, updated_at)
SELECT 'capability', pc.id, pc.project_id, pc.kind, pc.capability_id,
  COALESCE(cc.configuration, pc.configuration), 1, pc.excluded, pc.created_by, cc.id,
  cc.created_at, pc.created_at, CASE WHEN cc.id IS NOT NULL THEN cc.updated_at ELSE pc.created_at END
FROM project_capability pc
LEFT JOIN capability_configuration cc ON cc.scope_type = 'project' AND cc.scope_id = pc.project_id
  AND cc.capability_kind = pc.kind AND cc.capability_id = pc.capability_id;
--> statement-breakpoint
INSERT INTO scoped_configuration (kind, id, user_id, project_id, target_kind, target_id, payload, configuration_id, created_at, updated_at)
SELECT 'capability', 'configuration:' || cc.id,
  CASE WHEN cc.scope_type = 'user' THEN CAST(cc.scope_id AS INTEGER) END,
  CASE WHEN cc.scope_type = 'project' THEN cc.scope_id END,
  cc.capability_kind, cc.capability_id, cc.configuration, cc.id, cc.created_at, cc.updated_at
FROM capability_configuration cc
WHERE NOT EXISTS (SELECT 1 FROM project_capability pc WHERE cc.scope_type = 'project'
  AND pc.project_id = cc.scope_id AND pc.kind = cc.capability_kind AND pc.capability_id = cc.capability_id);
--> statement-breakpoint
INSERT INTO scoped_configuration (kind, id, project_id, target_id, encrypted_value, created_at, updated_at)
SELECT 'environment', id, project_id, name, encrypted_value, created_at, updated_at FROM project_environment_variable;
--> statement-breakpoint
CREATE TABLE scoped_configuration_copy_guard (
  valid INTEGER NOT NULL CHECK (valid = 1)
);
--> statement-breakpoint
INSERT INTO scoped_configuration_copy_guard (valid)
SELECT (SELECT count(*) FROM scoped_configuration WHERE kind = 'preferences') = (SELECT count(*) FROM user_settings);
--> statement-breakpoint
INSERT INTO scoped_configuration_copy_guard (valid)
SELECT (SELECT count(*) FROM scoped_configuration WHERE kind = 'provider') = (SELECT count(*) FROM inference_setting WHERE kind = 'provider');
--> statement-breakpoint
INSERT INTO scoped_configuration_copy_guard (valid)
SELECT (SELECT count(*) FROM scoped_configuration WHERE kind = 'model') = (SELECT count(*) FROM inference_setting WHERE kind = 'model');
--> statement-breakpoint
INSERT INTO scoped_configuration_copy_guard (valid)
SELECT (SELECT count(*) FROM scoped_configuration WHERE kind = 'environment') = (SELECT count(*) FROM project_environment_variable);
--> statement-breakpoint
INSERT INTO scoped_configuration_copy_guard (valid)
SELECT (SELECT count(*) FROM scoped_configuration WHERE kind = 'capability') = (
  (SELECT count(*) FROM project_capability) +
  (SELECT count(*) FROM capability_configuration cc WHERE NOT EXISTS (
    SELECT 1 FROM project_capability pc WHERE cc.scope_type = 'project'
      AND pc.project_id = cc.scope_id AND pc.kind = cc.capability_kind AND pc.capability_id = cc.capability_id
  ))
);
--> statement-breakpoint
DROP TABLE scoped_configuration_copy_guard;
--> statement-breakpoint
DROP TABLE project_environment_variable;
--> statement-breakpoint
DROP TABLE capability_configuration;
--> statement-breakpoint
DROP TABLE project_capability;
--> statement-breakpoint
DROP TABLE inference_setting;
--> statement-breakpoint
DROP TABLE user_settings;
