CREATE TABLE `memory_syntheses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`synthesis_text` text NOT NULL,
	`synthesis_version` integer DEFAULT 1,
	`memory_ids` text,
	`memory_count` integer DEFAULT 0,
	`tokens_used` integer,
	`namespace` text DEFAULT 'global',
	`is_active` integer DEFAULT true,
	`superseded_by` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `memory_syntheses_user_id_idx` ON `memory_syntheses` (`user_id`);--> statement-breakpoint
CREATE INDEX `memory_syntheses_namespace_idx` ON `memory_syntheses` (`namespace`);--> statement-breakpoint
CREATE INDEX `memory_syntheses_is_active_idx` ON `memory_syntheses` (`is_active`);--> statement-breakpoint
CREATE TABLE `task_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`execution_time_ms` integer,
	`error_message` text,
	`result_data` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `task_executions_task_id_idx` ON `task_executions` (`task_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`task_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`priority` integer DEFAULT 5,
	`user_id` integer,
	`task_data` text,
	`schedule_type` text DEFAULT 'immediate',
	`scheduled_at` text,
	`cron_expression` text,
	`created_by` text NOT NULL,
	`attempts` integer DEFAULT 0,
	`max_attempts` integer DEFAULT 3,
	`last_attempted_at` text,
	`completed_at` text,
	`error_message` text,
	`metadata` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tasks_user_id_idx` ON `tasks` (`user_id`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_task_type_idx` ON `tasks` (`task_type`);--> statement-breakpoint
CREATE INDEX `tasks_scheduled_at_idx` ON `tasks` (`scheduled_at`);--> statement-breakpoint
ALTER TABLE `memories` ADD `namespace` text DEFAULT 'global';--> statement-breakpoint
ALTER TABLE `memories` ADD `importance_score` integer DEFAULT 5;--> statement-breakpoint
ALTER TABLE `memories` ADD `last_accessed` text;--> statement-breakpoint
ALTER TABLE `memories` ADD `is_active` integer DEFAULT true;--> statement-breakpoint
CREATE INDEX `memories_namespace_idx` ON `memories` (`namespace`);--> statement-breakpoint
CREATE INDEX `memories_is_active_idx` ON `memories` (`is_active`);