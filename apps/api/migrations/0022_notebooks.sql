ALTER TABLE `resource_collection` ADD `instructions` text;--> statement-breakpoint
ALTER TABLE `resource_collection` ADD `settings` text;--> statement-breakpoint
ALTER TABLE `resource_collection` ADD `guide` text;--> statement-breakpoint
ALTER TABLE `resource` ADD `collection_id` text REFERENCES resource_collection(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `resource_collection_idx` ON `resource` (`collection_id`) WHERE collection_id IS NOT NULL;
