CREATE TABLE `conversation_run` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`project_id` text,
	`project_task_id` text,
	`initiator_user_id` integer NOT NULL,
	`status` text DEFAULT 'accepted' NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`terminal_reason` text,
	`last_message_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`started_at` text,
	`completed_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`initiator_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `conversation_run_conversation_updated_idx` ON `conversation_run` (`conversation_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `conversation_run_project_updated_idx` ON `conversation_run` (`project_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `conversation_run_project_task_idx` ON `conversation_run` (`project_task_id`);--> statement-breakpoint
CREATE INDEX `conversation_run_initiator_idx` ON `conversation_run` (`initiator_user_id`);--> statement-breakpoint
CREATE TABLE `conversation_run_command` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`command_id` text NOT NULL,
	`kind` text NOT NULL,
	`input_digest` text NOT NULL,
	`accepted_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `conversation_run`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_run_command_user_command_idx` ON `conversation_run_command` (`user_id`,`command_id`);--> statement-breakpoint
CREATE INDEX `conversation_run_command_run_accepted_idx` ON `conversation_run_command` (`run_id`,`accepted_at`);--> statement-breakpoint
ALTER TABLE `message` ADD `run_id` text REFERENCES conversation_run(id);--> statement-breakpoint
CREATE INDEX `message_run_id_idx` ON `message` (`run_id`);--> statement-breakpoint
ALTER TABLE `project_task` ADD `run_id` text REFERENCES conversation_run(id);--> statement-breakpoint
CREATE INDEX `project_task_run_idx` ON `project_task` (`run_id`);