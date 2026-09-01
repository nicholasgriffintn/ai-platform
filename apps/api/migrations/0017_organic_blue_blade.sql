ALTER TABLE `anonymous_user` ADD `credit_period` text;--> statement-breakpoint
ALTER TABLE `anonymous_user` ADD `spent_credit_micros` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `anonymous_user` ADD `reserved_credit_micros` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `daily_message_count`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `daily_reset`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `daily_pro_message_count`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `daily_pro_reset`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `byok_message_count`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `daily_byok_message_count`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `daily_byok_reset`;