ALTER TABLE `recipe_composio_trigger` ADD `condition` text;
--> statement-breakpoint
CREATE TABLE `recipe_event_receipt` (
	`id` text PRIMARY KEY NOT NULL,
	`trigger_id` text NOT NULL,
	`event_id` text NOT NULL,
	`state` text DEFAULT 'evaluating' NOT NULL,
	`execution_token` text,
	`execution_lease_expires_at` text,
	`decision_receipt` text,
	`task_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`trigger_id`) REFERENCES `recipe_composio_trigger`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_event_receipt_trigger_event_idx` ON `recipe_event_receipt` (`trigger_id`,`event_id`);
--> statement-breakpoint
CREATE INDEX `recipe_event_receipt_state_lease_idx` ON `recipe_event_receipt` (`state`,`execution_lease_expires_at`);
