UPDATE `tasks` SET `status` = 'pending', `execution_owner_token` = NULL, `updated_at` = datetime('now', '-10 minutes') WHERE `status` IN ('queued', 'running');--> statement-breakpoint
DROP INDEX IF EXISTS `tasks_execution_lease_idx`;--> statement-breakpoint
ALTER TABLE `tasks` DROP COLUMN `execution_lease_expires_at`;--> statement-breakpoint
ALTER TABLE `tasks` DROP COLUMN `recovery_count`;
