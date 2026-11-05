CREATE TABLE `message_approval` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`run_id` text NOT NULL,
	`run_attempt` integer NOT NULL,
	`conversation_id` text NOT NULL,
	`interaction_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`connector_approval_id` text,
	`argument_digest` text NOT NULL,
	`effect_class` text NOT NULL,
	`channel` text NOT NULL,
	`sender_key` text NOT NULL,
	`code_hash` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`expires_at` text NOT NULL,
	`resolved_message_id` text,
	`resolved_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_approval_code_idx` ON `message_approval` (`user_id`,`code_hash`);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_approval_target_idx` ON `message_approval` (`run_id`,`run_attempt`,`interaction_id`,`argument_digest`,`channel`,`sender_key`);
