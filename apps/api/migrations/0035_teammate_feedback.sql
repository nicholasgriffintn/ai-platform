CREATE TABLE `teammate_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`teammate_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`conversation_id` text,
	`verdict` text NOT NULL,
	`note` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`teammate_id`) REFERENCES `teammates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `teammate_feedback_teammate_idx` ON `teammate_feedback` (`teammate_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `teammate_feedback_user_conversation_idx` ON `teammate_feedback` (`user_id`,`teammate_id`,`conversation_id`);
