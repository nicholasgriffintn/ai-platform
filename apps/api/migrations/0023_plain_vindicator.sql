ALTER TABLE `app_data` ADD `share_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `app_data_share_id_unique` ON `app_data` (`share_id`);--> statement-breakpoint
CREATE INDEX `app_data_share_id_idx` ON `app_data` (`share_id`);