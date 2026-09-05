ALTER TABLE `project` ADD `coding_environment_cache` text;--> statement-breakpoint
ALTER TABLE `project` ADD `coding_cache_generation` integer DEFAULT 0 NOT NULL;