CREATE TABLE `source_search_chunk` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `source_search_document`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `source_search_chunk_document_idx` ON `source_search_chunk` (`document_id`);--> statement-breakpoint
CREATE TABLE `source_search_document` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`source_revision` integer NOT NULL,
	`user_id` integer NOT NULL,
	`project_id` text,
	`status` text DEFAULT 'lexical' NOT NULL,
	`target` text NOT NULL,
	`lease_token` text,
	`lease_expires_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	CONSTRAINT "source_search_document_lifecycle_check" CHECK(status IN ('lexical', 'active', 'stale')),
	CONSTRAINT "source_search_document_revision_check" CHECK(source_revision > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_search_document_revision_idx` ON `source_search_document` (`source_id`,`source_revision`);--> statement-breakpoint
CREATE INDEX `source_search_document_scope_idx` ON `source_search_document` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `source_search_document_status_idx` ON `source_search_document` (`status`);--> statement-breakpoint
ALTER TABLE `source` ADD `search_revision` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE VIRTUAL TABLE source_search_fts USING fts5(title, content, content='source_search_chunk', content_rowid='rowid', tokenize='unicode61');
--> statement-breakpoint
CREATE TRIGGER source_search_chunk_insert AFTER INSERT ON source_search_chunk BEGIN
  INSERT INTO source_search_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
END;
--> statement-breakpoint
CREATE TRIGGER source_search_chunk_delete AFTER DELETE ON source_search_chunk BEGIN
  INSERT INTO source_search_fts(source_search_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
END;
--> statement-breakpoint
CREATE TRIGGER source_search_revision_update
AFTER UPDATE OF content, title, status, project_id, created_by_user_id, external_uri, kind ON source
WHEN old.content IS NOT new.content OR old.title IS NOT new.title OR old.status IS NOT new.status
  OR old.project_id IS NOT new.project_id OR old.created_by_user_id IS NOT new.created_by_user_id
  OR old.external_uri IS NOT new.external_uri OR old.kind IS NOT new.kind
BEGIN
  UPDATE source SET search_revision = old.search_revision + 1 WHERE id = new.id;
  UPDATE source_search_document SET status = 'stale' WHERE source_id = new.id;
END;
--> statement-breakpoint
CREATE TRIGGER source_search_revision_delete AFTER DELETE ON source BEGIN
  UPDATE source_search_document SET status = 'stale' WHERE source_id = old.id;
END;
