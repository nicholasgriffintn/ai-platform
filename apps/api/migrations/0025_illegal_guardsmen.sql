CREATE TABLE `conversation_label` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` integer,
	`project_id` text,
	`name` text NOT NULL,
	`normalised_name` text NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "conversation_label_owner_check" CHECK(("conversation_label"."owner_user_id" IS NULL) <> ("conversation_label"."project_id" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_label_personal_name_idx` ON `conversation_label` (`owner_user_id`,`normalised_name`) WHERE "conversation_label"."owner_user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_label_project_name_idx` ON `conversation_label` (`project_id`,`normalised_name`) WHERE "conversation_label"."project_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `conversation_label_assignment` (
	`conversation_id` text NOT NULL,
	`label_id` text NOT NULL,
	`assigned_by_user_id` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`conversation_id`, `label_id`),
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`label_id`) REFERENCES `conversation_label`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `conversation_label_assignment_label_idx` ON `conversation_label_assignment` (`label_id`);--> statement-breakpoint
CREATE TABLE `conversation_user_state` (
	`conversation_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`is_pinned` integer DEFAULT false NOT NULL,
	`is_unread` integer DEFAULT false NOT NULL,
	`snoozed_until` text,
	`snoozed_next_response_at` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY(`conversation_id`, `user_id`),
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `conversation_user_state_pinned_idx` ON `conversation_user_state` (`user_id`,`is_pinned`);--> statement-breakpoint
CREATE INDEX `conversation_user_state_unread_idx` ON `conversation_user_state` (`user_id`,`is_unread`);--> statement-breakpoint
CREATE INDEX `conversation_user_state_snooze_idx` ON `conversation_user_state` (`user_id`,`snoozed_until`);