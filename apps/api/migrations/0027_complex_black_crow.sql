ALTER TABLE `agents` ADD `team_id` text;--> statement-breakpoint
ALTER TABLE `agents` ADD `team_role` text;--> statement-breakpoint
ALTER TABLE `agents` ADD `is_team_agent` integer DEFAULT false;