CREATE TABLE `training_deployments` (
	`provider` text NOT NULL,
	`endpoint_name` text NOT NULL,
	`deployment_name` text NOT NULL,
	`model_name` text NOT NULL,
	`endpoint_config_name` text NOT NULL,
	`user_id` integer,
	`status` text NOT NULL,
	`model_id` text NOT NULL,
	`model_artifacts_s3_uri` text,
	`failure_reason` text,
	`request_json` text,
	`response_json` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY(`provider`, `endpoint_name`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `training_deployments_user_id_idx` ON `training_deployments` (`user_id`);--> statement-breakpoint
CREATE INDEX `training_deployments_status_idx` ON `training_deployments` (`status`);--> statement-breakpoint
CREATE TABLE `training_job_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`job_name` text NOT NULL,
	`level` text NOT NULL,
	`message` text NOT NULL,
	`metadata_json` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `training_job_events_job_idx` ON `training_job_events` (`provider`,`job_name`);--> statement-breakpoint
CREATE INDEX `training_job_events_created_at_idx` ON `training_job_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `training_jobs` (
	`provider` text NOT NULL,
	`job_name` text NOT NULL,
	`provider_job_id` text,
	`user_id` integer,
	`status` text NOT NULL,
	`model_id` text NOT NULL,
	`base_model` text NOT NULL,
	`training_image` text,
	`training_data_s3_uri` text,
	`validation_data_s3_uri` text,
	`output_s3_uri` text,
	`model_artifacts_s3_uri` text,
	`failure_reason` text,
	`request_json` text,
	`response_json` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY(`provider`, `job_name`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `training_jobs_user_id_idx` ON `training_jobs` (`user_id`);--> statement-breakpoint
CREATE INDEX `training_jobs_status_idx` ON `training_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `training_jobs_updated_at_idx` ON `training_jobs` (`updated_at`);--> statement-breakpoint