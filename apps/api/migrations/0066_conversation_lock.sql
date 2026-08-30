CREATE TABLE `conversation_lock` (
	`conversation_id` text PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`title_envelope` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `conversation_lock_key` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`type` text NOT NULL,
	`credential_id` text,
	`label` text,
	`salt` text NOT NULL,
	`kdf` text,
	`kdf_iterations` integer,
	`wrapped_key` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`last_used_at` text,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `conversation_lock_key_conversation_id_idx` ON `conversation_lock_key` (`conversation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_lock_key_credential_idx` ON `conversation_lock_key` (`conversation_id`,`credential_id`) WHERE "conversation_lock_key"."credential_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `locked_message` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`seq` integer NOT NULL,
	`role` text NOT NULL,
	`envelope` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `locked_message_conversation_id_idx` ON `locked_message` (`conversation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `locked_message_conversation_seq_idx` ON `locked_message` (`conversation_id`,`seq`);--> statement-breakpoint
ALTER TABLE `conversation` ADD `locked_at` text;