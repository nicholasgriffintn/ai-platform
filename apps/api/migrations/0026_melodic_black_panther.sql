CREATE TABLE `task_inbox_receipt` (
	`user_id` integer NOT NULL,
	`task_id` text NOT NULL,
	`task_version` integer NOT NULL,
	`read_at` text,
	`dismissed_at` text,
	PRIMARY KEY(`user_id`, `task_id`, `task_version`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_inbox_receipt_task_idx` ON `task_inbox_receipt` (`task_id`,`task_version`);--> statement-breakpoint
CREATE TABLE `task_notification_delivery` (
	`id` text PRIMARY KEY NOT NULL,
	`dedupe_key` text NOT NULL,
	`registration_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`task_id` text NOT NULL,
	`task_version` integer NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`provider_message_id` text,
	`failure_code` text,
	`next_attempt_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`registration_id`) REFERENCES `task_notification_registration`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_notification_delivery_dedupe_key_unique` ON `task_notification_delivery` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `task_notification_delivery_pending_idx` ON `task_notification_delivery` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `task_notification_delivery_task_idx` ON `task_notification_delivery` (`task_id`,`task_version`);--> statement-breakpoint
CREATE TABLE `task_notification_preference` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`decisions` integer DEFAULT true NOT NULL,
	`failures` integer DEFAULT true NOT NULL,
	`completions` integer DEFAULT true NOT NULL,
	`assignments` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `task_notification_registration` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`installation_id` text NOT NULL,
	`platform` text NOT NULL,
	`endpoint_hash` text NOT NULL,
	`destination_json` text NOT NULL,
	`state` text DEFAULT 'registered' NOT NULL,
	`failure_code` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_notification_registration_owner_installation_idx` ON `task_notification_registration` (`user_id`,`platform`,`installation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `task_notification_registration_endpoint_idx` ON `task_notification_registration` (`platform`,`endpoint_hash`);--> statement-breakpoint
ALTER TABLE `project_task` ADD `attention_version` integer DEFAULT 1 NOT NULL;