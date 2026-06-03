CREATE TABLE `stored_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`owner_user_id` integer NOT NULL,
	`conversation_id` text,
	`message_id` text,
	`app_data_id` text,
	`purpose` text NOT NULL,
	`mime_type` text NOT NULL,
	`filename` text,
	`byte_size` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`message_id`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`app_data_id`) REFERENCES `app_data`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stored_asset_key_unique` ON `stored_asset` (`key`);--> statement-breakpoint
CREATE INDEX `stored_asset_owner_user_id_idx` ON `stored_asset` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `stored_asset_conversation_id_idx` ON `stored_asset` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `stored_asset_message_id_idx` ON `stored_asset` (`message_id`);--> statement-breakpoint
CREATE INDEX `stored_asset_app_data_id_idx` ON `stored_asset` (`app_data_id`);--> statement-breakpoint
CREATE INDEX `stored_asset_purpose_idx` ON `stored_asset` (`purpose`);