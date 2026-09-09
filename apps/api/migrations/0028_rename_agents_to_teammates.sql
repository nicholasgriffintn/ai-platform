ALTER TABLE `agents` RENAME TO `teammates`;--> statement-breakpoint
ALTER TABLE `shared_agents` RENAME TO `shared_teammates`;--> statement-breakpoint
ALTER TABLE `agent_installs` RENAME TO `teammate_installs`;--> statement-breakpoint
ALTER TABLE `agent_ratings` RENAME TO `teammate_ratings`;--> statement-breakpoint
ALTER TABLE `teammates` RENAME COLUMN `derived_from_agent_id` TO `derived_from_teammate_id`;--> statement-breakpoint
ALTER TABLE `shared_teammates` RENAME COLUMN `agent_id` TO `teammate_id`;--> statement-breakpoint
ALTER TABLE `teammate_installs` RENAME COLUMN `shared_agent_id` TO `shared_teammate_id`;--> statement-breakpoint
ALTER TABLE `teammate_installs` RENAME COLUMN `agent_id` TO `teammate_id`;--> statement-breakpoint
ALTER TABLE `teammate_ratings` RENAME COLUMN `shared_agent_id` TO `shared_teammate_id`;--> statement-breakpoint
ALTER TABLE `teammates` ADD `kind` text DEFAULT 'colleague' NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS `agents_user_id_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `agents_owner_scope_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `shared_agents_agent_id_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `shared_agents_user_id_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `shared_agents_category_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `shared_agents_featured_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `shared_agents_public_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `shared_agents_usage_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `shared_agents_rating_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `agent_installs_shared_agent_id_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `agent_installs_user_id_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `agent_installs_agent_id_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `agent_installs_unique_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `agent_ratings_shared_agent_id_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `agent_ratings_user_id_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `agent_ratings_rating_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `agent_ratings_unique_idx`;--> statement-breakpoint
CREATE INDEX `teammates_user_id_idx` ON `teammates` (`user_id`);--> statement-breakpoint
CREATE INDEX `teammates_owner_scope_idx` ON `teammates` (`owner_scope_type`,`owner_scope_id`);--> statement-breakpoint
CREATE INDEX `shared_teammates_teammate_id_idx` ON `shared_teammates` (`teammate_id`);--> statement-breakpoint
CREATE INDEX `shared_teammates_user_id_idx` ON `shared_teammates` (`user_id`);--> statement-breakpoint
CREATE INDEX `shared_teammates_category_idx` ON `shared_teammates` (`category`);--> statement-breakpoint
CREATE INDEX `shared_teammates_featured_idx` ON `shared_teammates` (`is_featured`);--> statement-breakpoint
CREATE INDEX `shared_teammates_public_idx` ON `shared_teammates` (`is_public`);--> statement-breakpoint
CREATE INDEX `shared_teammates_usage_idx` ON `shared_teammates` (`usage_count`);--> statement-breakpoint
CREATE INDEX `shared_teammates_rating_idx` ON `shared_teammates` (`rating_average`);--> statement-breakpoint
CREATE INDEX `teammate_installs_shared_teammate_id_idx` ON `teammate_installs` (`shared_teammate_id`);--> statement-breakpoint
CREATE INDEX `teammate_installs_user_id_idx` ON `teammate_installs` (`user_id`);--> statement-breakpoint
CREATE INDEX `teammate_installs_teammate_id_idx` ON `teammate_installs` (`teammate_id`);--> statement-breakpoint
CREATE INDEX `teammate_installs_unique_idx` ON `teammate_installs` (`shared_teammate_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `teammate_ratings_shared_teammate_id_idx` ON `teammate_ratings` (`shared_teammate_id`);--> statement-breakpoint
CREATE INDEX `teammate_ratings_user_id_idx` ON `teammate_ratings` (`user_id`);--> statement-breakpoint
CREATE INDEX `teammate_ratings_rating_idx` ON `teammate_ratings` (`rating`);--> statement-breakpoint
CREATE INDEX `teammate_ratings_unique_idx` ON `teammate_ratings` (`shared_teammate_id`,`user_id`);--> statement-breakpoint
UPDATE `project_capability` SET `kind` = 'teammate' WHERE `kind` = 'agent';
