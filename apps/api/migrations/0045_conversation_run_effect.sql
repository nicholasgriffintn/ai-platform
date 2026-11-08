CREATE TABLE conversation_run_effect (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  run_id TEXT NOT NULL REFERENCES conversation_run(id) ON DELETE CASCADE,
  run_attempt INTEGER NOT NULL,
  kind TEXT NOT NULL,
  actor_user_id INTEGER,
  owner_token TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  available_at TEXT NOT NULL,
  lease_owner TEXT,
  lease_expires_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX conversation_run_effect_run_kind_idx ON conversation_run_effect (run_id, run_attempt, kind);
CREATE INDEX conversation_run_effect_drain_idx ON conversation_run_effect (conversation_id, status, available_at);
CREATE INDEX conversation_run_effect_status_updated_idx ON conversation_run_effect (status, updated_at);
