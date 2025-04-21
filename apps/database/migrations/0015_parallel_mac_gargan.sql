CREATE TABLE `app_data` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`app_id` text NOT NULL,
	`item_id` text,
	`item_type` text,
	`data` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `app_data_user_id_idx` ON `app_data` (`user_id`);--> statement-breakpoint
CREATE INDEX `app_data_app_id_idx` ON `app_data` (`app_id`);--> statement-breakpoint
CREATE INDEX `app_data_item_id_idx` ON `app_data` (`item_id`);--> statement-breakpoint
CREATE INDEX `app_data_item_type_idx` ON `app_data` (`item_type`);--> statement-breakpoint
CREATE INDEX `app_data_lookup_idx` ON `app_data` (`user_id`,`app_id`,`item_id`,`item_type`);