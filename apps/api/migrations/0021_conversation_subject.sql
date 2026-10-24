ALTER TABLE `conversation` ADD `subject_type` text;--> statement-breakpoint
ALTER TABLE `conversation` ADD `subject_id` text;--> statement-breakpoint
CREATE INDEX `conversation_subject_idx` ON `conversation` (`user_id`,`subject_type`,`subject_id`);
