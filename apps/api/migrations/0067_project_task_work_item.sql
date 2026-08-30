ALTER TABLE `project_task` ADD `acceptance_criteria` text;--> statement-breakpoint
ALTER TABLE `project_task` ADD `deliverable` text;--> statement-breakpoint
ALTER TABLE `project_task` ADD `context` text;--> statement-breakpoint
ALTER TABLE `project_task` ADD `constraints` text;--> statement-breakpoint
ALTER TABLE `project_task` ADD `depends_on_task_ids` text;--> statement-breakpoint
ALTER TABLE `project_task` ADD `require_approval_for` text;--> statement-breakpoint
ALTER TABLE `project_task` ADD `priority` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_task` ADD `due_at` text;--> statement-breakpoint
CREATE INDEX `project_task_due_at_idx` ON `project_task` (`due_at`);