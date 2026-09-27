ALTER TABLE `model_deployment` ADD `provisioning_started_at` text;--> statement-breakpoint
ALTER TABLE `model_training_run` ADD `submission_started_at` text;--> statement-breakpoint
UPDATE `model_deployment` SET `provisioning_started_at` = coalesce(`last_checked_at`, `created_at`) WHERE `provider_ref` IS NULL AND `status` NOT IN ('pending');
--> statement-breakpoint
UPDATE `model_training_run` SET `submission_started_at` = coalesce(`started_at`, `created_at`) WHERE `provider_job_id` IS NOT NULL OR `status` NOT IN ('queued');
