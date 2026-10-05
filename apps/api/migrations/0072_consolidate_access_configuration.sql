DROP TRIGGER document_comment_authority_guard;
--> statement-breakpoint
CREATE TABLE new_resource_grant (
  kind text NOT NULL,
  id text NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  conversation_id text REFERENCES conversation(id) ON DELETE CASCADE,
  delegation_id text REFERENCES delegation(id) ON DELETE CASCADE,
  granted_by text,
  output_id text REFERENCES output(id) ON DELETE CASCADE,
  token_hash text,
  permission text DEFAULT 'view',
  created_by_user_id integer REFERENCES user(id),
  context_id text REFERENCES teammate_context(id) ON DELETE CASCADE,
  connection_id text REFERENCES provider_connection(id) ON DELETE CASCADE,
  allowed_operations text,
  revision integer DEFAULT 1 NOT NULL,
  expires_at text,
  revoked_at text,
  created_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
  updated_at text DEFAULT (CURRENT_TIMESTAMP),
  workspace_id TEXT REFERENCES workspace(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES user(id) ON DELETE CASCADE,
  role TEXT,
  email TEXT,
  status TEXT,
  accepted_by INTEGER REFERENCES user(id),
  accepted_at TEXT,
  PRIMARY KEY (kind, id),
  CONSTRAINT resource_grant_shape_check CHECK (
      (kind = 'conversation' AND conversation_id IS NOT NULL AND delegation_id IS NOT NULL AND granted_by IS NOT NULL AND granted_by IN ('spawn', 'user') AND output_id IS NULL AND context_id IS NULL AND connection_id IS NULL AND token_hash IS NULL AND created_by_user_id IS NULL AND allowed_operations IS NULL)
      OR (kind = 'output' AND output_id IS NOT NULL AND token_hash IS NOT NULL AND permission IS NOT NULL AND created_by_user_id IS NOT NULL AND conversation_id IS NULL AND delegation_id IS NULL AND context_id IS NULL AND connection_id IS NULL AND granted_by IS NULL AND allowed_operations IS NULL)
      OR (kind = 'connection' AND context_id IS NOT NULL AND connection_id IS NOT NULL AND allowed_operations IS NOT NULL AND conversation_id IS NULL AND delegation_id IS NULL AND output_id IS NULL AND token_hash IS NULL AND created_by_user_id IS NULL AND granted_by IS NULL AND expires_at IS NULL AND revoked_at IS NULL)
      OR (kind IN ('membership', 'invitation') AND conversation_id IS NULL AND delegation_id IS NULL AND granted_by IS NULL AND output_id IS NULL AND context_id IS NULL AND connection_id IS NULL AND allowed_operations IS NULL)
    ),
  CONSTRAINT resource_grant_organisation_shape CHECK (
      (kind NOT IN ('membership', 'invitation') AND workspace_id IS NULL AND user_id IS NULL AND role IS NULL AND email IS NULL AND status IS NULL AND accepted_by IS NULL AND accepted_at IS NULL)
      OR (kind = 'membership' AND workspace_id IS NOT NULL AND user_id IS NOT NULL AND role IS NOT NULL AND email IS NULL AND status IS NULL AND accepted_by IS NULL AND accepted_at IS NULL AND created_by_user_id IS NULL AND token_hash IS NULL AND expires_at IS NULL AND revoked_at IS NULL)
      OR (kind = 'invitation' AND workspace_id IS NOT NULL AND user_id IS NULL AND role IS NOT NULL AND email IS NOT NULL AND status IS NOT NULL AND created_by_user_id IS NOT NULL AND token_hash IS NOT NULL AND expires_at IS NOT NULL)
    )
);
--> statement-breakpoint
CREATE TABLE new_scoped_configuration (
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
  workspace_id TEXT REFERENCES workspace(id) ON DELETE CASCADE,
  owner_user_id INTEGER REFERENCES user(id) ON DELETE CASCADE,
  connection_id TEXT REFERENCES provider_connection(id) ON DELETE CASCADE,
  account_id TEXT,
  revision TEXT,
  PRIMARY KEY (kind, id),
  CONSTRAINT scoped_configuration_scope_check CHECK ((user_id IS NOT NULL) != (project_id IS NOT NULL)),
  CONSTRAINT scoped_configuration_kind_check CHECK ((kind IN ('preferences', 'provider', 'model') AND user_id IS NOT NULL AND (kind != 'provider' OR target_id IS NOT NULL)) OR (kind = 'capability' AND target_id IS NOT NULL) OR (kind = 'environment' AND project_id IS NOT NULL AND target_id IS NOT NULL AND encrypted_value IS NOT NULL) OR (kind = 'review_policy' AND project_id IS NOT NULL AND workspace_id IS NOT NULL AND owner_user_id IS NOT NULL AND connection_id IS NOT NULL AND account_id IS NOT NULL AND target_id IS NOT NULL AND enabled IS NOT NULL AND revision IS NOT NULL AND json_extract(payload, '$.token_budget') IS NOT NULL)),
  CONSTRAINT scoped_configuration_attachment_check CHECK (attached = 0 OR (kind = 'capability' AND project_id IS NOT NULL AND created_by IS NOT NULL)),
  CONSTRAINT scoped_configuration_review_shape CHECK (kind = 'review_policy' OR (workspace_id IS NULL AND owner_user_id IS NULL AND connection_id IS NULL AND account_id IS NULL AND revision IS NULL))
);
--> statement-breakpoint
INSERT INTO new_resource_grant (kind, id, conversation_id, delegation_id, granted_by, output_id, token_hash, permission, created_by_user_id, context_id, connection_id, allowed_operations, revision, expires_at, revoked_at, created_at, updated_at) SELECT kind, id, conversation_id, delegation_id, granted_by, output_id, token_hash, permission, created_by_user_id, context_id, connection_id, allowed_operations, revision, expires_at, revoked_at, created_at, updated_at FROM resource_grant;
--> statement-breakpoint
INSERT INTO new_scoped_configuration (kind, id, user_id, project_id, target_kind, target_id, payload, encrypted_value, public_key, enabled, attached, excluded, created_by, configuration_id, configuration_created_at, created_at, updated_at) SELECT kind, id, user_id, project_id, target_kind, target_id, payload, encrypted_value, public_key, enabled, attached, excluded, created_by, configuration_id, configuration_created_at, created_at, updated_at FROM scoped_configuration;
--> statement-breakpoint
INSERT INTO new_resource_grant(kind, workspace_id, user_id, role, created_at)
SELECT 'membership', workspace_id, user_id, role, joined_at FROM workspace_member;
--> statement-breakpoint
INSERT INTO new_resource_grant(kind, id, workspace_id, email, role, token_hash, status, created_by_user_id, accepted_by, expires_at, accepted_at, created_at, updated_at)
SELECT 'invitation', id, workspace_id, email, role, token_hash, status, invited_by, accepted_by, expires_at, accepted_at, created_at, updated_at FROM workspace_invitation;
--> statement-breakpoint
INSERT INTO new_scoped_configuration(kind, id, workspace_id, project_id, owner_user_id, connection_id, target_kind, account_id, target_id, enabled, payload, revision)
SELECT 'review_policy', id, workspace_id, project_id, owner_user_id, connection_id, provider, account_id, repository, enabled, json_object('token_budget', token_budget), revision FROM project_review_policy;
--> statement-breakpoint
CREATE TABLE access_configuration_copy_guard(valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
INSERT INTO access_configuration_copy_guard SELECT
 (SELECT count(*) FROM new_resource_grant WHERE kind NOT IN ('membership','invitation')) = (SELECT count(*) FROM resource_grant)
 AND (SELECT count(*) FROM new_resource_grant WHERE kind = 'membership') = (SELECT count(*) FROM workspace_member)
 AND (SELECT count(*) FROM new_resource_grant WHERE kind = 'invitation') = (SELECT count(*) FROM workspace_invitation)
 AND (SELECT count(*) FROM new_scoped_configuration WHERE kind != 'review_policy') = (SELECT count(*) FROM scoped_configuration)
 AND (SELECT count(*) FROM new_scoped_configuration WHERE kind = 'review_policy') = (SELECT count(*) FROM project_review_policy);
--> statement-breakpoint
DROP TABLE resource_grant;
--> statement-breakpoint
ALTER TABLE new_resource_grant RENAME TO resource_grant;
--> statement-breakpoint
DROP TABLE scoped_configuration;
--> statement-breakpoint
ALTER TABLE new_scoped_configuration RENAME TO scoped_configuration;
--> statement-breakpoint
CREATE UNIQUE INDEX resource_grant_delegation_idx ON resource_grant(delegation_id) WHERE delegation_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX resource_grant_conversation_idx ON resource_grant(conversation_id) WHERE conversation_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX resource_grant_token_idx ON resource_grant(kind, token_hash) WHERE token_hash IS NOT NULL;
--> statement-breakpoint
CREATE INDEX resource_grant_output_idx ON resource_grant(output_id) WHERE output_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX resource_grant_context_connection_idx ON resource_grant(context_id, connection_id) WHERE context_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX resource_grant_connection_idx ON resource_grant(connection_id) WHERE connection_id IS NOT NULL;
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
CREATE UNIQUE INDEX resource_grant_membership_idx ON resource_grant(workspace_id,user_id) WHERE kind='membership';
--> statement-breakpoint
CREATE INDEX resource_grant_member_user_idx ON resource_grant(user_id,workspace_id) WHERE kind='membership';
--> statement-breakpoint
CREATE UNIQUE INDEX resource_grant_invitation_email_idx ON resource_grant(workspace_id,email) WHERE kind='invitation';
--> statement-breakpoint
CREATE INDEX resource_grant_invitation_status_idx ON resource_grant(workspace_id,status) WHERE kind='invitation';
--> statement-breakpoint
CREATE INDEX resource_grant_workspace_idx ON resource_grant(workspace_id);
--> statement-breakpoint
CREATE INDEX resource_grant_accepted_by_idx ON resource_grant(accepted_by);
--> statement-breakpoint
CREATE UNIQUE INDEX scoped_configuration_review_identity_idx ON scoped_configuration(workspace_id,project_id,target_kind,connection_id,target_id) WHERE kind='review_policy';
--> statement-breakpoint
CREATE INDEX scoped_configuration_review_repository_idx ON scoped_configuration(target_kind,account_id,target_id,enabled) WHERE kind='review_policy';
--> statement-breakpoint
CREATE INDEX scoped_configuration_workspace_idx ON scoped_configuration(workspace_id);
--> statement-breakpoint
CREATE INDEX scoped_configuration_owner_idx ON scoped_configuration(owner_user_id);
--> statement-breakpoint
CREATE INDEX scoped_configuration_connection_idx ON scoped_configuration(connection_id);
--> statement-breakpoint
DROP TABLE workspace_member;
--> statement-breakpoint
DROP TABLE workspace_invitation;
--> statement-breakpoint
DROP TABLE project_review_policy;
--> statement-breakpoint
DROP TABLE access_configuration_copy_guard;
--> statement-breakpoint
CREATE TRIGGER document_comment_authority_guard
BEFORE INSERT ON document_comment
WHEN NOT EXISTS (
  SELECT 1 FROM output WHERE id = NEW.output_id
    AND ((project_id IS NULL AND created_by_user_id = NEW.author_user_id)
      OR EXISTS (SELECT 1 FROM project JOIN resource_grant member ON member.kind = 'membership' AND member.workspace_id = project.workspace_id
        WHERE project.id = output.project_id AND member.user_id = NEW.author_user_id))
)
BEGIN
  SELECT RAISE(ABORT, 'document_access_revoked');
END;
