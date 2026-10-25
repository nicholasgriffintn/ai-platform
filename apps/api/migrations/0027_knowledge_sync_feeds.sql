PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__new_source_knowledge_sync` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`project_id` text,
	`collection_id` text,
	`kind` text DEFAULT 'connector' NOT NULL,
	`connection_id` text,
	`recipe_id` text,
	`integration_id` text,
	`title` text NOT NULL,
	`resources` text,
	`feed` text,
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
	FOREIGN KEY (`collection_id`) REFERENCES `resource_collection`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `provider_connection`(`id`) ON UPDATE no action ON DELETE cascade,
	CHECK (`project_id` IS NULL OR `collection_id` IS NULL),
	CHECK (
		(`kind` = 'connector' AND (`project_id` IS NULL) <> (`collection_id` IS NULL) AND `connection_id` IS NOT NULL AND `recipe_id` IS NOT NULL
			AND `integration_id` IS NOT NULL AND `resources` IS NOT NULL AND `feed` IS NULL)
		OR (`kind` IN ('rss', 'news', 'web') AND `connection_id` IS NULL AND `recipe_id` IS NULL
			AND `integration_id` IS NULL AND `resources` IS NULL AND `feed` IS NOT NULL)
	)
);--> statement-breakpoint
INSERT INTO `__new_source_knowledge_sync` (`id`, `user_id`, `project_id`, `collection_id`, `kind`, `connection_id`, `recipe_id`, `integration_id`, `title`, `resources`, `feed`, `status`, `interval_minutes`, `cursor`, `generation`, `next_sync_at`, `last_successful_at`, `last_error`, `lease_token`, `lease_expires_at`)
SELECT `id`, `user_id`, `project_id`, `collection_id`, 'connector', `connection_id`, `recipe_id`, `integration_id`, `title`, `resources`, NULL, `status`, `interval_minutes`, `cursor`, `generation`, `next_sync_at`, `last_successful_at`, `last_error`, `lease_token`, `lease_expires_at` FROM `source_knowledge_sync`;--> statement-breakpoint
DROP TABLE `source_knowledge_sync`;--> statement-breakpoint
ALTER TABLE `__new_source_knowledge_sync` RENAME TO `source_knowledge_sync`;--> statement-breakpoint
CREATE INDEX `source_knowledge_sync_due_idx` ON `source_knowledge_sync` (`status`,`next_sync_at`);--> statement-breakpoint
CREATE INDEX `source_knowledge_sync_project_idx` ON `source_knowledge_sync` (`project_id`);--> statement-breakpoint
CREATE INDEX `source_knowledge_sync_library_idx` ON `source_knowledge_sync` (`user_id`) WHERE project_id IS NULL AND collection_id IS NULL;--> statement-breakpoint
CREATE INDEX `source_knowledge_sync_collection_idx` ON `source_knowledge_sync` (`collection_id`) WHERE collection_id IS NOT NULL;
