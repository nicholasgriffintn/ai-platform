CREATE TABLE `outbound_delivery` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`kind` text NOT NULL,
	`scope_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`payload_digest` text NOT NULL,
	`payload_json` text NOT NULL,
	`state` text DEFAULT 'prepared' NOT NULL,
	`execution_token` text,
	`execution_lease_expires_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sent_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `outbound_delivery_owner_state_idx` ON `outbound_delivery` (`user_id`,`state`);
--> statement-breakpoint
CREATE UNIQUE INDEX `outbound_delivery_operation_idx` ON `outbound_delivery` (`kind`,`scope_id`,`operation_id`);
