CREATE TABLE `mobile_auth_exchange_code` (
	`jti` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `mobile_auth_exchange_code_expires_at_idx` ON `mobile_auth_exchange_code` (`expires_at`);
--> statement-breakpoint
CREATE INDEX `mobile_auth_exchange_code_session_idx` ON `mobile_auth_exchange_code` (`session_id`);
