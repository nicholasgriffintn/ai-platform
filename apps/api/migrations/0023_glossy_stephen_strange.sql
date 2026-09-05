CREATE TABLE `conversation_run_event` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`protocol_version` integer DEFAULT 1 NOT NULL,
	`attempt` integer NOT NULL,
	`type` text NOT NULL,
	`occurred_at` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `conversation_run`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_run_event_run_sequence_idx` ON `conversation_run_event` (`run_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `conversation_run_event_run_occurred_idx` ON `conversation_run_event` (`run_id`,`occurred_at`);--> statement-breakpoint
ALTER TABLE `conversation_run` ADD `event_sequence` integer DEFAULT 0 NOT NULL;