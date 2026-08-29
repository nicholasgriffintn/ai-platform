CREATE TABLE `project_task` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`objective` text NOT NULL,
	`acceptance` text,
	`status` text DEFAULT 'backlog' NOT NULL,
	`source` text DEFAULT 'user' NOT NULL,
	`blocked_reason` text,
	`blocked_detail` text,
	`stage_id` text,
	`runner` text,
	`created_by_user_id` integer NOT NULL,
	`assignee_user_id` integer,
	`runner_identity_user_id` integer,
	`conversation_id` text,
	`goal_id` text,
	`position` real DEFAULT 0 NOT NULL,
	`token_budget` integer,
	`tokens_spent` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	`started_at` text,
	`completed_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignee_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`runner_identity_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `project_task_project_status_idx` ON `project_task` (`project_id`,`status`,`position`);--> statement-breakpoint
CREATE INDEX `project_task_workspace_status_idx` ON `project_task` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `project_task_assignee_idx` ON `project_task` (`assignee_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_task_conversation_idx` ON `project_task` (`conversation_id`) WHERE "project_task"."conversation_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE `project` ADD `flow` text;