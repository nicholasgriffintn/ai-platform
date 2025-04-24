CREATE TABLE `model_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`model_id` text DEFAULT 'default',
	`enabled` integer DEFAULT true,
	`api_key` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `model_settings_user_id_idx` ON `model_settings` (`user_id`);--> statement-breakpoint
CREATE INDEX `model_settings_model_id_idx` ON `model_settings` (`model_id`);--> statement-breakpoint
CREATE INDEX `model_settings_enabled_idx` ON `model_settings` (`enabled`);--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`nickname` text,
	`job_role` text,
	`traits` text,
	`preferences` text,
	`tracking_enabled` integer DEFAULT true,
	`public_key` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_settings_user_id_idx` ON `user_settings` (`user_id`);--> statement-breakpoint