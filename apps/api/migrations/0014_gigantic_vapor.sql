DROP INDEX `agents_team_id_idx`;--> statement-breakpoint
ALTER TABLE `agents` DROP COLUMN `team_id`;--> statement-breakpoint
ALTER TABLE `agents` DROP COLUMN `team_role`;--> statement-breakpoint
ALTER TABLE `agents` DROP COLUMN `is_team_agent`;