CREATE TABLE `machine` (
	`user_id` integer NOT NULL,
	`machine_id` text NOT NULL,
	`label` text NOT NULL,
	`platform` text NOT NULL,
	`app_version` text NOT NULL,
	`runtimes` text NOT NULL,
	`capabilities` text NOT NULL,
	`last_seen_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY(`user_id`, `machine_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `machine_user_idx` ON `machine` (`user_id`,`last_seen_at`);--> statement-breakpoint
ALTER TABLE `conversation` ADD `model_id` text;--> statement-breakpoint
ALTER TABLE `conversation` ADD `model_tier` text;--> statement-breakpoint
ALTER TABLE `conversation_run` ADD `provenance_json` text;--> statement-breakpoint
ALTER TABLE `message` ADD `provenance_json` text;--> statement-breakpoint
ALTER TABLE `usage_event` ADD `vendor_units` real;--> statement-breakpoint
ALTER TABLE `usage_event` ADD `reason` text;--> statement-breakpoint
ALTER TABLE `usage_event` ADD `site` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `default_model_tier` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `default_model_id` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `default_compute_site` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `onboarding_seen` text DEFAULT '[]' NOT NULL;