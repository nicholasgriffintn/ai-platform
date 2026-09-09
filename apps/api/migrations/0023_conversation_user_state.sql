CREATE TABLE `conversation_user_state` (
	`conversation_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`is_pinned` integer DEFAULT false NOT NULL,
	`is_unread` integer DEFAULT false NOT NULL,
	`snoozed_until` text,
	`snoozed_next_response_at` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY(`conversation_id`, `user_id`),
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `conversation_user_state_pinned_idx` ON `conversation_user_state` (`user_id`,`is_pinned`);--> statement-breakpoint
CREATE INDEX `conversation_user_state_unread_idx` ON `conversation_user_state` (`user_id`,`is_unread`);--> statement-breakpoint
CREATE INDEX `conversation_user_state_snooze_idx` ON `conversation_user_state` (`user_id`,`snoozed_until`);
