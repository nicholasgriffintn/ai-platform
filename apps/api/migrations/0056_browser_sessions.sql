CREATE TABLE `browser_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`conversation_id` text NOT NULL,
	`workspace_id` text,
	`provider` text NOT NULL,
	`credential_source` text NOT NULL,
	`provider_session_id` text,
	`tool_call_id` text NOT NULL,
	`input_hash` text NOT NULL,
	`creation_claimed` integer DEFAULT 0 NOT NULL,
	`creation_started_at` integer,
	`last_error` text,
	`model` text NOT NULL,
	`destroyed_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "browser_session_credential_source" CHECK("browser_session"."credential_source" IN ('user', 'workspace'))
);
--> statement-breakpoint
CREATE INDEX `browser_session_conversation` ON `browser_session` (`conversation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `browser_session_task_identity` ON `browser_session` (`user_id`,`conversation_id`,`tool_call_id`);