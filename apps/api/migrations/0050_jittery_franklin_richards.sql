ALTER TABLE `project` ADD `coding_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `project` ADD `coding_installation_id` integer;--> statement-breakpoint
ALTER TABLE `project` ADD `coding_repository` text;--> statement-breakpoint
ALTER TABLE `project` ADD `coding_task_type` text DEFAULT 'feature-implementation' NOT NULL;--> statement-breakpoint
ALTER TABLE `project` ADD `coding_prompt_strategy` text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE `project` ADD `coding_should_commit` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `project` ADD `coding_timeout_seconds` integer DEFAULT 900 NOT NULL;