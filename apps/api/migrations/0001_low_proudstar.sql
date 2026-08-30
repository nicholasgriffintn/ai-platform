CREATE TABLE `user_pet` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`origin` text NOT NULL,
	`sheet_key` text NOT NULL,
	`layout_version` integer DEFAULT 1 NOT NULL,
	`prompt` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_pet_user_id_idx` ON `user_pet` (`user_id`);--> statement-breakpoint
ALTER TABLE `user_settings` ADD `pet_source` text DEFAULT 'preset';--> statement-breakpoint
ALTER TABLE `user_settings` ADD `pet_id` text DEFAULT 'pip';--> statement-breakpoint
ALTER TABLE `user_settings` ADD `pet_travel_enabled` integer DEFAULT false;