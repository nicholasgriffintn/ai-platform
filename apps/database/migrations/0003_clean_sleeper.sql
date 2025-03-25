ALTER TABLE `conversation` ADD `is_public` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `conversation` ADD `share_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_share_id_unique` ON `conversation` (`share_id`);--> statement-breakpoint
CREATE INDEX `conversation_public_idx` ON `conversation` (`is_public`);--> statement-breakpoint
CREATE INDEX `conversation_share_id_idx` ON `conversation` (`share_id`);