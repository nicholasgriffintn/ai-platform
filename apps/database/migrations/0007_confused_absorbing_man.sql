CREATE TABLE `provider_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`api_key` text,
	`enabled` integer DEFAULT false,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `provider_settings_user_id_idx` ON `provider_settings` (`user_id`);--> statement-breakpoint
CREATE INDEX `provider_settings_provider_id_idx` ON `provider_settings` (`provider_id`);