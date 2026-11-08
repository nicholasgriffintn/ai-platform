CREATE TABLE secret_reference (
  id TEXT PRIMARY KEY NOT NULL,
  reference_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  project_id TEXT,
  conversation_id TEXT NOT NULL,
  interaction_id TEXT NOT NULL,
  label TEXT NOT NULL,
  destination TEXT,
  sealed_value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE UNIQUE INDEX secret_reference_hash_idx ON secret_reference (reference_hash);
CREATE UNIQUE INDEX secret_reference_interaction_idx ON secret_reference (conversation_id, interaction_id);
CREATE INDEX secret_reference_user_expires_idx ON secret_reference (user_id, expires_at);
