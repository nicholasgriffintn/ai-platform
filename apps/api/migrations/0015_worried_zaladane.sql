CREATE TABLE `infra_cost_daily` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`resource` text NOT NULL,
	`unit` text NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`cost_micros` integer DEFAULT 0 NOT NULL,
	`attributed_cost_micros` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'graphql' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE INDEX `infra_cost_daily_day_idx` ON `infra_cost_daily` (`day`);--> statement-breakpoint
CREATE TABLE `usage_balance` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`period` text NOT NULL,
	`plan_id` text,
	`included_credit_micros` integer DEFAULT 0 NOT NULL,
	`grace_credit_micros` integer DEFAULT 0 NOT NULL,
	`spent_credit_micros` integer DEFAULT 0 NOT NULL,
	`reserved_credit_micros` integer DEFAULT 0 NOT NULL,
	`overrun_credit_micros` integer DEFAULT 0 NOT NULL,
	`overage_credit_micros` integer DEFAULT 0 NOT NULL,
	`overage_enabled` integer DEFAULT false NOT NULL,
	`last_event_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usage_balance_user_period_idx` ON `usage_balance` (`user_id`,`period`);--> statement-breakpoint
CREATE TABLE `usage_event` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`user_id` integer NOT NULL,
	`workspace_id` text,
	`project_id` text,
	`conversation_id` text,
	`message_id` text,
	`activity_id` text,
	`completion_id` text,
	`occurred_at` text NOT NULL,
	`period` text NOT NULL,
	`source` text NOT NULL,
	`vendor` text NOT NULL,
	`resource` text NOT NULL,
	`unit` text NOT NULL,
	`quantity` real NOT NULL,
	`rate_version` text,
	`unit_cost_micros` real,
	`cost_micros` integer DEFAULT 0 NOT NULL,
	`credit_micros` integer DEFAULT 0 NOT NULL,
	`billable` integer DEFAULT true NOT NULL,
	`byok` integer DEFAULT false NOT NULL,
	`estimated` integer DEFAULT false NOT NULL,
	`raw` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usage_event_idempotency_key_unique` ON `usage_event` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `usage_event_user_period_idx` ON `usage_event` (`user_id`,`period`);--> statement-breakpoint
CREATE INDEX `usage_event_period_source_idx` ON `usage_event` (`period`,`source`);--> statement-breakpoint
CREATE INDEX `usage_event_conversation_idx` ON `usage_event` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `usage_event_workspace_period_idx` ON `usage_event` (`workspace_id`,`period`);--> statement-breakpoint
CREATE TABLE `usage_reservation` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`period` text NOT NULL,
	`kind` text NOT NULL,
	`ref_id` text NOT NULL,
	`credit_micros` integer NOT NULL,
	`status` text NOT NULL,
	`expires_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usage_reservation_kind_ref_idx` ON `usage_reservation` (`kind`,`ref_id`);--> statement-breakpoint
CREATE INDEX `usage_reservation_user_period_idx` ON `usage_reservation` (`user_id`,`period`);--> statement-breakpoint
ALTER TABLE `plans` ADD `included_credits` integer;--> statement-breakpoint
ALTER TABLE `plans` ADD `grace_credits` integer;--> statement-breakpoint
ALTER TABLE `plans` ADD `stripe_meter_id` text;--> statement-breakpoint
ALTER TABLE `plans` ADD `overage_price_id` text;