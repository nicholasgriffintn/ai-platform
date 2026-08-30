ALTER TABLE `project_task` ADD `capabilities` text;--> statement-breakpoint
ALTER TABLE `project_task` ADD `approval_consequences` text;--> statement-breakpoint
ALTER TABLE `project_task` ADD `effort` text DEFAULT 'standard' NOT NULL;