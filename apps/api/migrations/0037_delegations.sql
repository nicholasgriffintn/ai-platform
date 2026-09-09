CREATE TABLE `delegation` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_conversation_id` text NOT NULL,
	`child_conversation_id` text NOT NULL,
	`parent_run_id` text NOT NULL,
	`depth` integer NOT NULL,
	`teammate_id` text NOT NULL,
	`goal` text NOT NULL,
	`wait_for` text NOT NULL,
	`max_credit_micros` integer NOT NULL,
	`max_steps` integer NOT NULL,
	`deadline` text NOT NULL,
	`state` text DEFAULT 'queued' NOT NULL,
	`result_json` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`parent_conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_run_id`) REFERENCES `conversation_run`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `delegation_parent_conversation_idx` ON `delegation` (`parent_conversation_id`);--> statement-breakpoint
CREATE INDEX `delegation_child_conversation_idx` ON `delegation` (`child_conversation_id`);--> statement-breakpoint
ALTER TABLE `conversation_run` ADD `trigger` text DEFAULT 'user' NOT NULL;
