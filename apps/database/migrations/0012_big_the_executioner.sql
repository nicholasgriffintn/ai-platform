CREATE TABLE `magic_link_nonce` (
	`nonce` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `magic_link_nonce_user_idx` ON `magic_link_nonce` (`user_id`);--> statement-breakpoint
CREATE INDEX `magic_link_nonce_expires_idx` ON `magic_link_nonce` (`expires_at`);