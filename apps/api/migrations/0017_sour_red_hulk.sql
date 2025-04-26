CREATE TABLE `anonymous_user` (
	`id` text PRIMARY KEY NOT NULL,
	`ip_address` text NOT NULL,
	`user_agent` text,
	`daily_message_count` integer DEFAULT 0,
	`daily_reset` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	`last_active_at` text
);
