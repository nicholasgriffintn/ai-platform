CREATE TABLE `conversation_group` (
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
	CONSTRAINT "conversation_group_owner_check" CHECK(("conversation_group"."owner_user_id" IS NULL) <> ("conversation_group"."project_id" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_group_personal_name_idx` ON `conversation_group` (`owner_user_id`,`normalised_name`) WHERE "conversation_group"."owner_user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_group_project_name_idx` ON `conversation_group` (`project_id`,`normalised_name`) WHERE "conversation_group"."project_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `conversation_group_membership` (
	`conversation_id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`assigned_by_user_id` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `conversation_group`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `conversation_group_membership_group_idx` ON `conversation_group_membership` (`group_id`);--> statement-breakpoint
DROP TABLE `conversation_label`;--> statement-breakpoint
DROP TABLE `conversation_label_assignment`;