CREATE TABLE `conversation_run` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`project_id` text,
	`project_task_id` text,
	`stage_id` text,
	`initiator_user_id` integer NOT NULL,
	`status` text DEFAULT 'accepted' NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`event_sequence` integer DEFAULT 0 NOT NULL,
	`terminal_reason` text,
	`last_message_id` text,
	`context_json` text,
	`retry_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`started_at` text,
	`completed_at` text,
	`cancellation_requested_at` text,
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
CREATE TABLE `conversation_run_event` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`protocol_version` integer DEFAULT 1 NOT NULL,
	`attempt` integer NOT NULL,
	`type` text NOT NULL,
	`occurred_at` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `conversation_run`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_run_event_run_sequence_idx` ON `conversation_run_event` (`run_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `conversation_run_event_run_occurred_idx` ON `conversation_run_event` (`run_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `task_inbox_receipt` (
	`user_id` integer NOT NULL,
	`task_id` text NOT NULL,
	`task_version` integer NOT NULL,
	`read_at` text,
	`dismissed_at` text,
	PRIMARY KEY(`user_id`, `task_id`, `task_version`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_inbox_receipt_task_idx` ON `task_inbox_receipt` (`task_id`,`task_version`);--> statement-breakpoint
CREATE TABLE `task_notification_delivery` (
	`id` text PRIMARY KEY NOT NULL,
	`dedupe_key` text NOT NULL,
	`registration_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`task_id` text NOT NULL,
	`task_version` integer NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`provider_message_id` text,
	`failure_code` text,
	`next_attempt_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`registration_id`) REFERENCES `task_notification_registration`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_notification_delivery_dedupe_key_unique` ON `task_notification_delivery` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `task_notification_delivery_pending_idx` ON `task_notification_delivery` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `task_notification_delivery_task_idx` ON `task_notification_delivery` (`task_id`,`task_version`);--> statement-breakpoint
CREATE TABLE `task_notification_preference` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`decisions` integer DEFAULT true NOT NULL,
	`failures` integer DEFAULT true NOT NULL,
	`completions` integer DEFAULT true NOT NULL,
	`assignments` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `task_notification_registration` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`installation_id` text NOT NULL,
	`platform` text NOT NULL,
	`endpoint_hash` text NOT NULL,
	`destination_json` text NOT NULL,
	`state` text DEFAULT 'registered' NOT NULL,
	`failure_code` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_notification_registration_owner_installation_idx` ON `task_notification_registration` (`user_id`,`platform`,`installation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `task_notification_registration_endpoint_idx` ON `task_notification_registration` (`platform`,`endpoint_hash`);--> statement-breakpoint
ALTER TABLE `message` ADD `run_id` text REFERENCES conversation_run(id);--> statement-breakpoint
CREATE INDEX `message_run_id_idx` ON `message` (`run_id`);--> statement-breakpoint
ALTER TABLE `output` ADD `provenance_json` text;--> statement-breakpoint
ALTER TABLE `output` ADD `revision_created_by_user_id` integer REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `output` ADD `revision_created_at` text;--> statement-breakpoint
ALTER TABLE `output` ADD `revision_operation` text;--> statement-breakpoint
ALTER TABLE `output` ADD `restored_from_revision` integer;--> statement-breakpoint
ALTER TABLE `output_revision` ADD `provenance_json` text;--> statement-breakpoint
ALTER TABLE `output_revision` ADD `operation` text;--> statement-breakpoint
ALTER TABLE `output_revision` ADD `restored_from_revision` integer;--> statement-breakpoint
ALTER TABLE `project_task` ADD `flow_snapshot` text;--> statement-breakpoint
ALTER TABLE `project_task` ADD `run_id` text REFERENCES conversation_run(id);--> statement-breakpoint
ALTER TABLE `project_task` ADD `attention_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `project_task_run_idx` ON `project_task` (`run_id`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `execution_owner_token` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `execution_lease_expires_at` text;--> statement-breakpoint
CREATE INDEX `tasks_execution_lease_idx` ON `tasks` (`status`,`execution_lease_expires_at`);--> statement-breakpoint
ALTER TABLE `usage_event` ADD `run_id` text;--> statement-breakpoint
ALTER TABLE `usage_event` ADD `run_attempt` integer;--> statement-breakpoint
CREATE INDEX `usage_event_run_idx` ON `usage_event` (`run_id`,`run_attempt`);