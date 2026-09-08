CREATE TABLE `conversation_handle` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`delegation_id` text NOT NULL,
	`granted_by` text NOT NULL,
	`granted_at` text NOT NULL,
	`expires_at` text,
	`revoked_at` text,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`delegation_id`) REFERENCES `delegation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_handle_delegation_idx` ON `conversation_handle` (`delegation_id`);--> statement-breakpoint
CREATE INDEX `conversation_handle_conversation_idx` ON `conversation_handle` (`conversation_id`);