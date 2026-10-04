CREATE TABLE integration_definition (
  id TEXT PRIMARY KEY NOT NULL,
  user_id INTEGER NOT NULL REFERENCES user(id),
  workspace_id TEXT REFERENCES workspace(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT integration_definition_revision_check CHECK (revision >= 1)
);

CREATE INDEX integration_definition_owner_idx ON integration_definition(user_id, workspace_id);
CREATE INDEX integration_definition_workspace_idx ON integration_definition(workspace_id);

CREATE TABLE integration_definition_revision (
  definition_id TEXT NOT NULL REFERENCES integration_definition(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (definition_id, revision),
  CONSTRAINT integration_definition_revision_number_check CHECK (revision >= 1),
  CONSTRAINT integration_definition_revision_snapshot_check CHECK (json_valid(snapshot))
);
