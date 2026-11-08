PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__new_authentication_token` (
	`purpose` text NOT NULL,
	`token_hash` text NOT NULL,
	`provider` text,
	`kind` text,
	`payload` text,
	`oauth_data` text,
	`session_id` text,
	`binding_id` text,
	`user_id` integer,
	`consumed_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`expires_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`purpose`, `token_hash`),
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`binding_id`) REFERENCES `channel_binding`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "authentication_token_purpose_check" CHECK(
      ("purpose" = 'oauth_state' AND "provider" IS NOT NULL AND "oauth_data" IS NOT NULL AND "kind" IS NULL AND "payload" IS NULL AND "session_id" IS NULL AND "binding_id" IS NULL AND "user_id" IS NULL AND "consumed_at" IS NULL)
      OR ("purpose" = 'challenge' AND "provider" IS NOT NULL AND "kind" IS NOT NULL AND "payload" IS NOT NULL AND "oauth_data" IS NULL AND "session_id" IS NULL AND "binding_id" IS NULL AND "user_id" IS NULL AND "consumed_at" IS NULL)
      OR ("purpose" = 'native_exchange' AND "session_id" IS NOT NULL AND "user_id" IS NOT NULL AND "consumed_at" IS NOT NULL AND "binding_id" IS NULL AND "provider" IS NULL AND "kind" IS NULL AND "payload" IS NULL AND "oauth_data" IS NULL)
      OR ("purpose" = 'channel_pairing' AND "binding_id" IS NOT NULL AND "user_id" IS NOT NULL AND "session_id" IS NULL AND "provider" IS NULL AND "kind" IS NULL AND "payload" IS NULL AND "oauth_data" IS NULL AND "consumed_at" IS NULL)
      OR ("purpose" = 'secret_reference' AND "user_id" IS NOT NULL AND "payload" IS NOT NULL AND "session_id" IS NULL AND "binding_id" IS NULL AND "provider" IS NULL AND "kind" IS NULL AND "oauth_data" IS NULL AND "consumed_at" IS NULL)
    )
);
--> statement-breakpoint
INSERT INTO `__new_authentication_token` (`purpose`, `token_hash`, `provider`, `kind`, `payload`, `oauth_data`, `session_id`, `binding_id`, `user_id`, `consumed_at`, `created_at`, `expires_at`, `attempts`)
SELECT `purpose`, `token_hash`, `provider`, `kind`, `payload`, `oauth_data`, `session_id`, `binding_id`, `user_id`, `consumed_at`, `created_at`, `expires_at`, `attempts` FROM `authentication_token`;--> statement-breakpoint
DROP TABLE `authentication_token`;--> statement-breakpoint
ALTER TABLE `__new_authentication_token` RENAME TO `authentication_token`;--> statement-breakpoint
CREATE INDEX `authentication_token_expires_at_idx` ON `authentication_token` (`purpose`,`expires_at`);--> statement-breakpoint
CREATE INDEX `authentication_token_session_idx` ON `authentication_token` (`session_id`);--> statement-breakpoint
CREATE INDEX `authentication_token_user_idx` ON `authentication_token` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `authentication_token_pairing_owner_idx` ON `authentication_token` (`binding_id`,`user_id`) WHERE "authentication_token"."purpose" = 'channel_pairing';
