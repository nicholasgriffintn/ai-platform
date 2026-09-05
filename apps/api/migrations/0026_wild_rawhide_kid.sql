CREATE TABLE `mobile_push_delivery` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`status` text NOT NULL,
	`error_code` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`device_id`) REFERENCES `mobile_push_device`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mobile_push_delivery_device_idx` ON `mobile_push_delivery` (`device_id`);--> statement-breakpoint
CREATE TABLE `mobile_push_device` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`token` text NOT NULL,
	`environment` text NOT NULL,
	`app_bundle_id` text NOT NULL,
	`last_registered_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`invalidated_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mobile_push_device_token_unique` ON `mobile_push_device` (`token`);--> statement-breakpoint
CREATE INDEX `mobile_push_device_user_idx` ON `mobile_push_device` (`user_id`,`invalidated_at`);