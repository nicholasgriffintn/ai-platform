CREATE TABLE `source_knowledge_sync` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`project_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`title` text NOT NULL,
	`pages` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`interval_minutes` integer DEFAULT 60 NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL,
	`generation` integer DEFAULT 1 NOT NULL,
	`next_sync_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`last_successful_at` text,
	`last_error` text,
	`lease_token` text,
	`lease_expires_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `provider_connection`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `source_knowledge_sync_due_idx` ON `source_knowledge_sync` (`status`,`next_sync_at`);--> statement-breakpoint
CREATE INDEX `source_knowledge_sync_project_idx` ON `source_knowledge_sync` (`project_id`);