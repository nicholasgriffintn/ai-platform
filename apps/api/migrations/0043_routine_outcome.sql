CREATE TABLE routine_outcome (
  id TEXT PRIMARY KEY NOT NULL,
  user_id INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  project_id TEXT,
  routine_kind TEXT NOT NULL,
  routine_id TEXT NOT NULL,
  run_id TEXT,
  status TEXT NOT NULL,
  false_completion INTEGER NOT NULL DEFAULT 0,
  occurred_at TEXT NOT NULL
);

CREATE INDEX routine_outcome_user_occurred_idx ON routine_outcome (user_id, occurred_at);
