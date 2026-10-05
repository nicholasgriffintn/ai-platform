CREATE TABLE `knowledge_sync` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`project_id` text,
	`repository` text NOT NULL,
	`branch` text NOT NULL,
	`path` text DEFAULT '' NOT NULL,
	`installation_id` integer NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`checkpoint` text,
	`lease_token` text,
	`lease_expires_at` integer,
	`last_synced_at` text,
	`last_commit` text,
	`next_sync_at` integer NOT NULL,
	`error_message` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `knowledge_sync_owner_idx` ON `knowledge_sync` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `knowledge_sync_project_idx` ON `knowledge_sync` (`project_id`);--> statement-breakpoint
CREATE INDEX `knowledge_sync_due_idx` ON `knowledge_sync` (`status`,`next_sync_at`);--> statement-breakpoint
CREATE TABLE `knowledge_sync_document` (
	`source_id` text PRIMARY KEY NOT NULL,
	`sync_id` text NOT NULL,
	`path` text NOT NULL,
	`blob_sha` text NOT NULL,
	`commit_sha` text NOT NULL,
	`seen_run_id` text NOT NULL,
	`synced_at` text NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `source`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sync_id`) REFERENCES `knowledge_sync`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_sync_document_path_idx` ON `knowledge_sync_document` (`sync_id`,`path`);
--> statement-breakpoint
CREATE TRIGGER knowledge_sync_delete_sources
BEFORE DELETE ON knowledge_sync
BEGIN
  DELETE FROM source WHERE id IN (
    SELECT source_id FROM knowledge_sync_document WHERE sync_id = OLD.id
  );
END;
