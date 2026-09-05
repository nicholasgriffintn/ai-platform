ALTER TABLE `conversation_run` ADD `cancellation_requested_at` text;--> statement-breakpoint
ALTER TABLE `usage_event` ADD `run_id` text;--> statement-breakpoint
ALTER TABLE `usage_event` ADD `run_attempt` integer;--> statement-breakpoint
CREATE INDEX `usage_event_run_idx` ON `usage_event` (`run_id`,`run_attempt`);