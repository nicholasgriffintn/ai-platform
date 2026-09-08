CREATE TABLE `handoff` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`conversation_id` text NOT NULL,
	`machine_id` text NOT NULL,
	`requested` text NOT NULL,
	`draft` text,
	`state` text DEFAULT 'pending' NOT NULL,
	`claimed_by` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`expires_at` text NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `handoff_user_idx` ON `handoff` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `handoff_pending_idx` ON `handoff` (`machine_id`,`state`,`expires_at`);