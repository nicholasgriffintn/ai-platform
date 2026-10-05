CREATE TABLE `channel_pairing_challenge` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`binding_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`binding_id`) REFERENCES `channel_binding`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channel_pairing_challenge_owner_idx` ON `channel_pairing_challenge` (`binding_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `channel_sender` (
	`id` text PRIMARY KEY NOT NULL,
	`binding_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`revoked_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`binding_id`) REFERENCES `channel_binding`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channel_sender_identity_idx` ON `channel_sender` (`binding_id`,`sender_id`);--> statement-breakpoint
CREATE INDEX `channel_sender_user_idx` ON `channel_sender` (`user_id`);
--> statement-breakpoint
UPDATE channel_binding SET enabled = 0 WHERE channel = 'slack' AND instr(external_id, ':') = 0;
--> statement-breakpoint
CREATE TRIGGER channel_sender_identity_immutable BEFORE UPDATE ON channel_sender
WHEN NEW.id IS NOT OLD.id OR NEW.binding_id IS NOT OLD.binding_id OR NEW.sender_id IS NOT OLD.sender_id
  OR NEW.user_id IS NOT OLD.user_id OR NEW.created_at IS NOT OLD.created_at OR NEW.revision != OLD.revision + 1
BEGIN
  SELECT RAISE(ABORT, 'Channel sender identity is immutable');
END;
