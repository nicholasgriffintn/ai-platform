CREATE TABLE source_sync (
  id TEXT PRIMARY KEY NOT NULL,
  created_by_user_id INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES project(id) ON DELETE CASCADE,
  connection_id TEXT NOT NULL REFERENCES provider_connection(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider = 'googledrive'),
  root_id TEXT NOT NULL,
  title TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  checkpoint TEXT NOT NULL DEFAULT '{}',
  run_id TEXT,
  page INTEGER NOT NULL DEFAULT 0,
  last_synced_at TEXT,
  next_sync_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX source_sync_root_idx ON source_sync(connection_id, project_id, provider, root_id);
--> statement-breakpoint
CREATE INDEX source_sync_due_idx ON source_sync(enabled, next_sync_at);
--> statement-breakpoint
CREATE UNIQUE INDEX source_sync_personal_root_idx ON source_sync(connection_id, provider, root_id) WHERE project_id IS NULL;
--> statement-breakpoint
ALTER TABLE source ADD COLUMN sync_id TEXT REFERENCES source_sync(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE source ADD COLUMN upstream_id TEXT;
--> statement-breakpoint
ALTER TABLE source ADD COLUMN upstream_version TEXT;
--> statement-breakpoint
ALTER TABLE source ADD COLUMN seen_run_id TEXT;
--> statement-breakpoint
ALTER TABLE source ADD COLUMN permission_grants TEXT;
--> statement-breakpoint
ALTER TABLE source ADD COLUMN permissions_valid_until TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX source_sync_upstream_idx ON source(sync_id, upstream_id);
--> statement-breakpoint
CREATE TRIGGER source_sync_deleted BEFORE DELETE ON source_sync BEGIN
  DELETE FROM source WHERE sync_id = old.id;
END;
