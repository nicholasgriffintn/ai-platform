CREATE TABLE `correction` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`teammate_context_id` text,
	`pattern` text NOT NULL,
	`quote` text NOT NULL,
	`conversation_id` text,
	`placement` text NOT NULL,
	`placement_ref` text,
	`recurrences` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`last_recurred_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`teammate_context_id`) REFERENCES `teammate_context`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `correction_user_status_idx` ON `correction` (`user_id`,`status`,`created_at`);