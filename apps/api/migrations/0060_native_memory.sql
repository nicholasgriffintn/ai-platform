CREATE TABLE `memory_reflection_checkpoint` (
	`id` text PRIMARY KEY NOT NULL,
	`context_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`message_id` text NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`context_id`) REFERENCES `teammate_context`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memory_reflection_checkpoint_context_conversation_idx` ON `memory_reflection_checkpoint` (`context_id`,`conversation_id`);--> statement-breakpoint
CREATE TABLE `memory_reflection_result` (
	`id` text PRIMARY KEY NOT NULL,
	`context_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`through_message_id` text NOT NULL,
	`revision` integer NOT NULL,
	`status` text NOT NULL,
	`evidence_json` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`context_id`) REFERENCES `teammate_context`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade
);
