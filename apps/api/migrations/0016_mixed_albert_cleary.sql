ALTER TABLE `user` ADD `message_count` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `user` ADD `daily_message_count` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `user` ADD `daily_reset` text;--> statement-breakpoint
ALTER TABLE `user` ADD `daily_pro_message_count` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `user` ADD `daily_pro_reset` text;--> statement-breakpoint
ALTER TABLE `user` ADD `last_active_at` text;