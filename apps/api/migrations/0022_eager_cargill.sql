ALTER TABLE `tasks` ADD `execution_owner_token` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `execution_lease_expires_at` text;--> statement-breakpoint
CREATE INDEX `tasks_execution_lease_idx` ON `tasks` (`status`,`execution_lease_expires_at`);