CREATE TABLE `model_alias` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text,
	`scope_key` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`route_id` text,
	`canary_route_id` text,
	`canary_percent` integer DEFAULT 0 NOT NULL,
	`gate` text,
	`requires_approval` integer DEFAULT false NOT NULL,
	`updated_by` integer,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`route_id`) REFERENCES `model_route`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`canary_route_id`) REFERENCES `model_route`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_alias_name_idx` ON `model_alias` (`workspace_id`,`scope_key`,`name`);
--> statement-breakpoint
CREATE TABLE `model_alias_event` (
	`id` text PRIMARY KEY NOT NULL,
	`alias_id` text NOT NULL,
	`kind` text NOT NULL,
	`from_route_id` text,
	`to_route_id` text,
	`reason` text,
	`gate` text,
	`actor_user_id` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`alias_id`) REFERENCES `model_alias`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `model_alias_event_alias_idx` ON `model_alias_event` (`alias_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `model_budget` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text,
	`scope_key` text NOT NULL,
	`monthly_limit_usd` real NOT NULL,
	`soft_limit_percent` integer DEFAULT 80 NOT NULL,
	`hard_stop` integer DEFAULT true NOT NULL,
	`approval_above_usd` real,
	`idle_pause_minutes` integer,
	`updated_by` integer,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_budget_scope_idx` ON `model_budget` (`workspace_id`,`scope_key`);
--> statement-breakpoint
CREATE TABLE `model_cost_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`provider` text NOT NULL,
	`usd` real NOT NULL,
	`basis` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `model_cost_entry_workspace_period_idx` ON `model_cost_entry` (`workspace_id`,`period_start`);
--> statement-breakpoint
CREATE INDEX `model_cost_entry_subject_idx` ON `model_cost_entry` (`subject_type`,`subject_id`);
--> statement-breakpoint
CREATE TABLE `model_dataset_profile` (
	`version_id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`shape` text NOT NULL,
	`mapping` text NOT NULL,
	`governance` text NOT NULL,
	`collection_method` text NOT NULL,
	`source_ref` text NOT NULL,
	`request` text DEFAULT '{}' NOT NULL,
	`stats` text DEFAULT '{}' NOT NULL,
	`failure_reason` text,
	`processed_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `model_deployment` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text,
	`name` text NOT NULL,
	`version_id` text NOT NULL,
	`spec` text NOT NULL,
	`spec_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`desired_state` text DEFAULT 'running' NOT NULL,
	`provider` text NOT NULL,
	`host` text NOT NULL,
	`provider_ref` text,
	`region` text,
	`jurisdiction` text,
	`weights_verified` integer DEFAULT false NOT NULL,
	`route_id` text,
	`hourly_usd` real,
	`failure_reason` text,
	`created_by` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`last_checked_at` text,
	`billed_until` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `model_deployment_workspace_idx` ON `model_deployment` (`workspace_id`,`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_deployment_name_idx` ON `model_deployment` (`workspace_id`,`name`);
--> statement-breakpoint
CREATE TABLE `model_grader` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text,
	`name` text NOT NULL,
	`metric` text NOT NULL,
	`description` text,
	`config` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `model_grader_workspace_idx` ON `model_grader` (`workspace_id`,`project_id`);
--> statement-breakpoint
CREATE TABLE `model_permission` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`grants` text NOT NULL,
	`separation_of_duties` integer DEFAULT false NOT NULL,
	`updated_by` integer,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `model_spend_request` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text,
	`subject_type` text NOT NULL,
	`payload` text NOT NULL,
	`estimate_usd` real,
	`reason` text,
	`state` text DEFAULT 'pending' NOT NULL,
	`subject_id` text,
	`requested_by` integer,
	`decided_by` integer,
	`decided_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`decided_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `model_spend_request_workspace_idx` ON `model_spend_request` (`workspace_id`,`state`);
--> statement-breakpoint
CREATE TABLE `model_training_checkpoint` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`step` integer NOT NULL,
	`provider_ref` text NOT NULL,
	`version_id` text,
	`metrics` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `model_training_run`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_training_checkpoint_run_step_idx` ON `model_training_checkpoint` (`run_id`,`step`);
--> statement-breakpoint
CREATE TABLE `model_training_run` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text,
	`spec` text NOT NULL,
	`spec_hash` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`provider` text NOT NULL,
	`trainer` text NOT NULL,
	`provider_job_id` text,
	`output_repository` text,
	`output_version_id` text,
	`dataset_version_ids` text DEFAULT '[]' NOT NULL,
	`estimate` text NOT NULL,
	`cost_usd` real,
	`compute` text,
	`failure_reason` text,
	`created_by` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`started_at` text,
	`completed_at` text,
	`last_checked_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`output_version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `model_training_run_workspace_idx` ON `model_training_run` (`workspace_id`,`status`,`created_at`);
--> statement-breakpoint
CREATE TABLE `model_upload` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`purpose` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'uploading' NOT NULL,
	`files` text NOT NULL,
	`part_bytes` integer NOT NULL,
	`failure_reason` text,
	`consumed_by` text,
	`created_by` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `model_upload_workspace_idx` ON `model_upload` (`workspace_id`,`created_at`);
--> statement-breakpoint
ALTER TABLE `model_route` ADD `deployment_id` text;
--> statement-breakpoint
ALTER TABLE `model_route` ADD `jurisdiction` text;
--> statement-breakpoint
ALTER TABLE `model_route` ADD `retention` text;
--> statement-breakpoint
ALTER TABLE `model_eval_suite` ADD `grader_ids` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `model_eval_suite` DROP COLUMN `scorers`;
--> statement-breakpoint
ALTER TABLE `workspace_provider_connection` ADD `capabilities` text DEFAULT '{"read":false,"store":false,"train":false,"host":false}' NOT NULL;
--> statement-breakpoint
DROP TABLE `model_build`;
--> statement-breakpoint
DELETE FROM `workspace_provider_connection`;--> statement-breakpoint
DROP TABLE `training_deployments`;--> statement-breakpoint
DROP TABLE `training_job_events`;--> statement-breakpoint
DROP TABLE `training_jobs`;--> statement-breakpoint
ALTER TABLE `model_route` DROP COLUMN `deployment_ref`;--> statement-breakpoint
DELETE FROM `project_capability` WHERE `capability_id` = 'featured-finetuning';--> statement-breakpoint
DELETE FROM `capability_configuration` WHERE `capability_id` = 'featured-finetuning';
