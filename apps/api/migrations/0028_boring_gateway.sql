ALTER TABLE `output` ADD `revision_created_by_user_id` integer REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `output` ADD `revision_created_at` text;--> statement-breakpoint
ALTER TABLE `output` ADD `revision_operation` text;--> statement-breakpoint
ALTER TABLE `output` ADD `restored_from_revision` integer;--> statement-breakpoint
ALTER TABLE `output_revision` ADD `operation` text;--> statement-breakpoint
ALTER TABLE `output_revision` ADD `restored_from_revision` integer;