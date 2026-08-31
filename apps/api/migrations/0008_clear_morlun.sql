ALTER TABLE `project_task` ADD `sandbox_run_id` text;--> statement-breakpoint
ALTER TABLE `project_task` ADD `output_id` text;--> statement-breakpoint
ALTER TABLE `project_task` ADD `projection_claim_id` text;--> statement-breakpoint
ALTER TABLE `project_task` ADD `idempotency_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `project_task_sandbox_run_idx` ON `project_task` (`sandbox_run_id`) WHERE "project_task"."sandbox_run_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `project_task_output_idx` ON `project_task` (`output_id`) WHERE "project_task"."output_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `project_task_idempotency_idx` ON `project_task` (`project_id`,`created_by_user_id`,`idempotency_key`) WHERE "project_task"."idempotency_key" IS NOT NULL;