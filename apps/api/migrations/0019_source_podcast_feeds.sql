ALTER TABLE `resource_collection` ADD `feed_token_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `resource_collection_feed_token_idx` ON `resource_collection` (`feed_token_hash`) WHERE "resource_collection"."feed_token_hash" IS NOT NULL;
