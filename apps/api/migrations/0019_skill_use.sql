CREATE TABLE `skill_use` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`revision_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`run_id` text,
	`conversation_id` text NOT NULL,
	`activation` text NOT NULL,
	`used_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `skill_use_skill_used_idx` ON `skill_use` (`skill_id`,`used_at`);--> statement-breakpoint
CREATE INDEX `skill_use_run_idx` ON `skill_use` (`run_id`);