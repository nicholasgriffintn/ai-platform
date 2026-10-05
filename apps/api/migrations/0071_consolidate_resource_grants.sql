CREATE TABLE resource_grant (
  kind text NOT NULL,
  id text NOT NULL,
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
  PRIMARY KEY (kind, id),
  CONSTRAINT resource_grant_shape_check CHECK (
    (kind = 'conversation' AND conversation_id IS NOT NULL AND delegation_id IS NOT NULL AND granted_by IS NOT NULL AND granted_by IN ('spawn', 'user') AND output_id IS NULL AND context_id IS NULL AND connection_id IS NULL AND token_hash IS NULL AND created_by_user_id IS NULL AND allowed_operations IS NULL)
    OR (kind = 'output' AND output_id IS NOT NULL AND token_hash IS NOT NULL AND permission IS NOT NULL AND created_by_user_id IS NOT NULL AND conversation_id IS NULL AND delegation_id IS NULL AND context_id IS NULL AND connection_id IS NULL AND granted_by IS NULL AND allowed_operations IS NULL)
    OR (kind = 'connection' AND context_id IS NOT NULL AND connection_id IS NOT NULL AND allowed_operations IS NOT NULL AND conversation_id IS NULL AND delegation_id IS NULL AND output_id IS NULL AND token_hash IS NULL AND created_by_user_id IS NULL AND granted_by IS NULL AND expires_at IS NULL AND revoked_at IS NULL)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX resource_grant_delegation_idx ON resource_grant(delegation_id) WHERE delegation_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX resource_grant_conversation_idx ON resource_grant(conversation_id) WHERE conversation_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX resource_grant_token_idx ON resource_grant(token_hash) WHERE token_hash IS NOT NULL;
--> statement-breakpoint
CREATE INDEX resource_grant_output_idx ON resource_grant(output_id) WHERE output_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX resource_grant_context_connection_idx ON resource_grant(context_id, connection_id) WHERE context_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX resource_grant_connection_idx ON resource_grant(connection_id) WHERE connection_id IS NOT NULL;
--> statement-breakpoint
INSERT INTO resource_grant (kind, id, conversation_id, delegation_id, granted_by, created_at, expires_at, revoked_at)
SELECT 'conversation', id, conversation_id, delegation_id, granted_by, granted_at, expires_at, revoked_at FROM conversation_handle;
--> statement-breakpoint
INSERT INTO resource_grant (kind, id, output_id, token_hash, permission, created_by_user_id, expires_at, revoked_at, created_at)
SELECT 'output', id, output_id, token_hash, permission, created_by_user_id, expires_at, revoked_at, created_at FROM output_share;
--> statement-breakpoint
INSERT INTO resource_grant (kind, id, context_id, connection_id, allowed_operations, revision, created_at, updated_at)
SELECT 'connection', id, context_id, connection_id, allowed_operations, revision, created_at, updated_at FROM teammate_connection_grant;
--> statement-breakpoint
CREATE TABLE __resource_grant_copy_guard (valid integer NOT NULL CHECK (valid = 1));
--> statement-breakpoint
INSERT INTO __resource_grant_copy_guard SELECT
  (SELECT count(*) FROM resource_grant WHERE kind = 'conversation') = (SELECT count(*) FROM conversation_handle)
  AND (SELECT count(*) FROM resource_grant WHERE kind = 'output') = (SELECT count(*) FROM output_share)
  AND (SELECT count(*) FROM resource_grant WHERE kind = 'connection') = (SELECT count(*) FROM teammate_connection_grant);
--> statement-breakpoint
DROP TABLE conversation_handle;
--> statement-breakpoint
DROP TABLE output_share;
--> statement-breakpoint
DROP TABLE teammate_connection_grant;
--> statement-breakpoint
DROP TABLE __resource_grant_copy_guard;
--> statement-breakpoint
CREATE INDEX project_task_integration_source_idx ON project_task_integration(source_id);
