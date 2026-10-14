CREATE TABLE `webhook_endpoint` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`url` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`events` text NOT NULL,
	`encrypted_secret` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `webhook_endpoint_user_idx` ON `webhook_endpoint` (`user_id`,`created_at`);