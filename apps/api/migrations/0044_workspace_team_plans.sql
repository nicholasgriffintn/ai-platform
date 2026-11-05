CREATE TABLE workspace_team_plan (
  workspace_id TEXT PRIMARY KEY NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  seat_limit INTEGER NOT NULL,
  included_credit_micros INTEGER NOT NULL,
  grace_credit_micros INTEGER NOT NULL DEFAULT 0,
  provisioned_by INTEGER REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE workspace_usage_pool (
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  spent_credit_micros INTEGER NOT NULL DEFAULT 0,
  reserved_credit_micros INTEGER NOT NULL DEFAULT 0,
  overrun_credit_micros INTEGER NOT NULL DEFAULT 0,
  last_event_at TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (workspace_id, period)
);

ALTER TABLE usage_reservation ADD COLUMN workspace_id TEXT;
ALTER TABLE usage_event ADD COLUMN pool_workspace_id TEXT;
