ALTER TABLE channel_binding ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0);--> statement-breakpoint
ALTER TABLE channel_binding ADD COLUMN workspace_id TEXT NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE channel_binding ADD COLUMN allowed_sender_ids TEXT NOT NULL DEFAULT '[]';--> statement-breakpoint
ALTER TABLE channel_binding ADD COLUMN reply_mode TEXT NOT NULL DEFAULT 'mentions' CHECK (reply_mode IN ('mentions', 'all'));--> statement-breakpoint
UPDATE channel_binding SET enabled = 0;--> statement-breakpoint
DROP INDEX channel_binding_channel_external_idx;--> statement-breakpoint
CREATE UNIQUE INDEX channel_binding_channel_external_idx ON channel_binding (channel, workspace_id, external_id);--> statement-breakpoint
CREATE TABLE channel_thread (
  binding_id TEXT NOT NULL REFERENCES channel_binding(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  muted INTEGER NOT NULL DEFAULT 0 CHECK (muted IN (0, 1)),
  last_control_order TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);--> statement-breakpoint
CREATE UNIQUE INDEX channel_thread_binding_thread_idx ON channel_thread(binding_id, thread_id);--> statement-breakpoint
