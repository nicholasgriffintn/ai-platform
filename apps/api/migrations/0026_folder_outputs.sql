PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__new_resource_link` (
	`kind` text NOT NULL,
	`output_id` text,
	`collection_id` text,
	`source_id` text,
	`from_version_id` text,
	`to_version_id` text,
	`relation` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`output_id`) REFERENCES `resource`(`output_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collection_id`) REFERENCES `resource_collection`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `resource`(`source_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "resource_link_shape_check" CHECK((`kind` = 'output_source' AND `output_id` IS NOT NULL AND `source_id` IS NOT NULL AND `collection_id` IS NULL AND `from_version_id` IS NULL AND `to_version_id` IS NULL AND `relation` IS NULL) OR (`kind` = 'source_collection' AND `collection_id` IS NOT NULL AND `source_id` IS NOT NULL AND `output_id` IS NULL AND `from_version_id` IS NULL AND `to_version_id` IS NULL AND `relation` IS NULL) OR (`kind` = 'output_collection' AND `collection_id` IS NOT NULL AND `output_id` IS NOT NULL AND `source_id` IS NULL AND `from_version_id` IS NULL AND `to_version_id` IS NULL AND `relation` IS NULL) OR (`kind` = 'model_lineage' AND `from_version_id` IS NOT NULL AND `to_version_id` IS NOT NULL AND `relation` IS NOT NULL AND `output_id` IS NULL AND `collection_id` IS NULL AND `source_id` IS NULL))
);--> statement-breakpoint
INSERT INTO `__new_resource_link` (`kind`, `output_id`, `collection_id`, `source_id`, `from_version_id`, `to_version_id`, `relation`, `created_at`)
SELECT `kind`, `output_id`, `collection_id`, `source_id`, `from_version_id`, `to_version_id`, `relation`, `created_at` FROM `resource_link`;--> statement-breakpoint
DROP TABLE `resource_link`;--> statement-breakpoint
ALTER TABLE `__new_resource_link` RENAME TO `resource_link`;--> statement-breakpoint
CREATE UNIQUE INDEX `resource_link_output_source_idx` ON `resource_link` (`output_id`,`source_id`) WHERE "resource_link"."kind" = 'output_source';--> statement-breakpoint
CREATE UNIQUE INDEX `resource_link_collection_source_idx` ON `resource_link` (`collection_id`,`source_id`) WHERE "resource_link"."kind" = 'source_collection';--> statement-breakpoint
CREATE UNIQUE INDEX `resource_link_collection_output_idx` ON `resource_link` (`collection_id`,`output_id`) WHERE "resource_link"."kind" = 'output_collection';--> statement-breakpoint
CREATE UNIQUE INDEX `resource_link_lineage_idx` ON `resource_link` (`from_version_id`,`to_version_id`,`relation`) WHERE "resource_link"."kind" = 'model_lineage';--> statement-breakpoint
CREATE INDEX `resource_link_source_idx` ON `resource_link` (`kind`,`source_id`);--> statement-breakpoint
CREATE INDEX `resource_link_lineage_target_idx` ON `resource_link` (`kind`,`to_version_id`);
