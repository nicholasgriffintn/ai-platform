CREATE TABLE `conversation` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`title` text DEFAULT 'New Conversation',
	`is_archived` integer DEFAULT false,
	`last_message_id` text,
	`last_message_at` text,
	`message_count` integer DEFAULT 0,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `conversation_title_idx` ON `conversation` (`title`);--> statement-breakpoint
CREATE INDEX `conversation_archived_idx` ON `conversation` (`is_archived`);--> statement-breakpoint
CREATE INDEX `conversation_user_id_idx` ON `conversation` (`user_id`);--> statement-breakpoint
CREATE TABLE `message` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`parent_message_id` text,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`name` text,
	`tool_calls` text,
	`citations` text,
	`model` text,
	`status` text,
	`timestamp` integer,
	`platform` text,
	`mode` text,
	`log_id` text,
	`data` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `message_conversation_id_idx` ON `message` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `message_parent_message_id_idx` ON `message` (`parent_message_id`);--> statement-breakpoint
CREATE INDEX `message_role_idx` ON `message` (`role`);