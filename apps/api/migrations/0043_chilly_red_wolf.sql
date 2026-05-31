ALTER TABLE `user` ADD `byok_message_count` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `user` ADD `daily_byok_message_count` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `user` ADD `daily_byok_reset` text;