CREATE TABLE `goal` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text,
	`sandbox_run_id` text,
	`user_id` integer NOT NULL,
	`objective` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`source` text DEFAULT 'user' NOT NULL,
	`iteration_count` integer DEFAULT 0 NOT NULL,
	`stall_streak` integer DEFAULT 0 NOT NULL,
	`tokens_spent` integer DEFAULT 0 NOT NULL,
	`progress` text,
	`evidence` text,
	`stopped_reason` text,
	`created_from_message_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	`completed_at` text,
	`last_continued_at` text,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CHECK ((`conversation_id` IS NULL) <> (`sandbox_run_id` IS NULL))
);
--> statement-breakpoint
CREATE INDEX `goal_conversation_id_idx` ON `goal` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `goal_sandbox_run_id_idx` ON `goal` (`sandbox_run_id`);--> statement-breakpoint
CREATE INDEX `goal_user_id_idx` ON `goal` (`user_id`);--> statement-breakpoint
CREATE INDEX `goal_status_idx` ON `goal` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `goal_active_conversation_idx` ON `goal` (`conversation_id`) WHERE `status` IN ('active','paused') AND `conversation_id` IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `goal_active_sandbox_run_idx` ON `goal` (`sandbox_run_id`) WHERE `status` IN ('active','paused') AND `sandbox_run_id` IS NOT NULL;
