DROP INDEX `project_task_due_at_idx`;--> statement-breakpoint
ALTER TABLE `project_task` ADD `expected_output` text;--> statement-breakpoint
ALTER TABLE `project_task` ADD `dispatch_task_id` text;--> statement-breakpoint
ALTER TABLE `project_task` DROP COLUMN `deliverable`;--> statement-breakpoint
ALTER TABLE `project_task` DROP COLUMN `capabilities`;--> statement-breakpoint
ALTER TABLE `project_task` DROP COLUMN `approval_consequences`;--> statement-breakpoint
ALTER TABLE `project_task` DROP COLUMN `effort`;--> statement-breakpoint
ALTER TABLE `project_task` DROP COLUMN `priority`;--> statement-breakpoint
ALTER TABLE `project_task` DROP COLUMN `due_at`;