PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_provider_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`provider` text NOT NULL,
	`kind` text NOT NULL,
	`external_id` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'connected' NOT NULL,
	`encrypted_data` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_provider_connection`("id", "user_id", "provider", "kind", "external_id", "status", "encrypted_data", "metadata", "created_at", "updated_at") SELECT "id", "user_id", "provider", "kind", "external_id", "status", "encrypted_data", "metadata", "created_at", "updated_at" FROM `provider_connection`;--> statement-breakpoint
DROP TABLE `provider_connection`;--> statement-breakpoint
ALTER TABLE `__new_provider_connection` RENAME TO `provider_connection`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `provider_connection_user_provider_idx` ON `provider_connection` (`user_id`,`provider`);--> statement-breakpoint
CREATE UNIQUE INDEX `provider_connection_unique_idx` ON `provider_connection` (`user_id`,`provider`,`kind`,`external_id`);