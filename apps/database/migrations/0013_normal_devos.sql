CREATE TABLE `user_api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`api_key` text NOT NULL,
	`hashed_key` text NOT NULL,
	`name` text DEFAULT 'API Key',
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_api_keys_hashed_key_unique` ON `user_api_keys` (`hashed_key`);--> statement-breakpoint
CREATE INDEX `user_api_keys_user_id_idx` ON `user_api_keys` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_api_keys_hashed_key_idx` ON `user_api_keys` (`hashed_key`);