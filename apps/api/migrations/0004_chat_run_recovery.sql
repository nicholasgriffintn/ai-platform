ALTER TABLE `conversation_run` ADD `partial_content` text;
--> statement-breakpoint
CREATE INDEX `conversation_run_status_updated_idx` ON `conversation_run` (`status`,`updated_at`);