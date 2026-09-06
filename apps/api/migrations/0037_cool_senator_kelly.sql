CREATE TABLE `message_user_state` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`conversation_id` text NOT NULL,
	`message_id` text NOT NULL,
	`note` text,
	`saved_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_user_state_user_message_idx` ON `message_user_state` (`user_id`,`message_id`);--> statement-breakpoint
CREATE INDEX `message_user_state_user_saved_idx` ON `message_user_state` (`user_id`,`saved_at`);