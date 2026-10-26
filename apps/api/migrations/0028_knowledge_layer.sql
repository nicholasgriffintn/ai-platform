PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__new_resource_link` (
	`kind` text NOT NULL,
	`output_id` text,
	`collection_id` text,
	`source_id` text,
	`related_source_id` text,
	`from_version_id` text,
	`to_version_id` text,
	`relation` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`output_id`) REFERENCES `resource`(`output_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collection_id`) REFERENCES `resource_collection`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `resource`(`source_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`related_source_id`) REFERENCES `resource`(`source_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "resource_link_shape_check" CHECK((`kind` = 'output_source' AND `output_id` IS NOT NULL AND `source_id` IS NOT NULL AND `collection_id` IS NULL AND `related_source_id` IS NULL AND `from_version_id` IS NULL AND `to_version_id` IS NULL AND `relation` IS NULL) OR (`kind` = 'source_collection' AND `collection_id` IS NOT NULL AND `source_id` IS NOT NULL AND `output_id` IS NULL AND `related_source_id` IS NULL AND `from_version_id` IS NULL AND `to_version_id` IS NULL AND `relation` IS NULL) OR (`kind` = 'output_collection' AND `collection_id` IS NOT NULL AND `output_id` IS NOT NULL AND `source_id` IS NULL AND `related_source_id` IS NULL AND `from_version_id` IS NULL AND `to_version_id` IS NULL AND `relation` IS NULL) OR (`kind` = 'source_relation' AND `source_id` IS NOT NULL AND `related_source_id` IS NOT NULL AND `source_id` != `related_source_id` AND `relation` IN ('cites', 'duplicates', 'updates', 'mentions', 'derived_from') AND `output_id` IS NULL AND `collection_id` IS NULL AND `from_version_id` IS NULL AND `to_version_id` IS NULL) OR (`kind` = 'model_lineage' AND `from_version_id` IS NOT NULL AND `to_version_id` IS NOT NULL AND `relation` IS NOT NULL AND `output_id` IS NULL AND `collection_id` IS NULL AND `source_id` IS NULL AND `related_source_id` IS NULL))
);--> statement-breakpoint
INSERT INTO `__new_resource_link` (`kind`, `output_id`, `collection_id`, `source_id`, `from_version_id`, `to_version_id`, `relation`, `created_at`)
SELECT `kind`, `output_id`, `collection_id`, `source_id`, `from_version_id`, `to_version_id`, `relation`, `created_at` FROM `resource_link`;--> statement-breakpoint
DROP TABLE `resource_link`;--> statement-breakpoint
ALTER TABLE `__new_resource_link` RENAME TO `resource_link`;--> statement-breakpoint
CREATE UNIQUE INDEX `resource_link_output_source_idx` ON `resource_link` (`output_id`,`source_id`) WHERE "resource_link"."kind" = 'output_source';--> statement-breakpoint
CREATE UNIQUE INDEX `resource_link_collection_source_idx` ON `resource_link` (`collection_id`,`source_id`) WHERE "resource_link"."kind" = 'source_collection';--> statement-breakpoint
CREATE UNIQUE INDEX `resource_link_collection_output_idx` ON `resource_link` (`collection_id`,`output_id`) WHERE "resource_link"."kind" = 'output_collection';--> statement-breakpoint
CREATE UNIQUE INDEX `resource_link_source_relation_idx` ON `resource_link` (`source_id`,`related_source_id`,`relation`) WHERE "resource_link"."kind" = 'source_relation';--> statement-breakpoint
CREATE UNIQUE INDEX `resource_link_lineage_idx` ON `resource_link` (`from_version_id`,`to_version_id`,`relation`) WHERE "resource_link"."kind" = 'model_lineage';--> statement-breakpoint
CREATE INDEX `resource_link_source_idx` ON `resource_link` (`kind`,`source_id`);--> statement-breakpoint
CREATE INDEX `resource_link_related_source_idx` ON `resource_link` (`related_source_id`) WHERE "resource_link"."kind" = 'source_relation';--> statement-breakpoint
CREATE INDEX `resource_link_lineage_target_idx` ON `resource_link` (`kind`,`to_version_id`);--> statement-breakpoint
ALTER TABLE `search_document` ADD `resource_type` text DEFAULT 'source' NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS `search_document_source_revision_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `search_document_source_revision_idx` ON `search_document` (`resource_type`,`source_id`,`source_revision`) WHERE document_type = 'source';--> statement-breakpoint
DROP TRIGGER IF EXISTS `source_search_revision_delete`;--> statement-breakpoint
CREATE TRIGGER source_search_revision_delete AFTER DELETE ON resource WHEN old.resource_type IN ('source', 'output') BEGIN
  UPDATE search_document SET status = 'stale' WHERE document_type = 'source' AND resource_type = old.resource_type AND source_id = old.id;
END;--> statement-breakpoint
DROP TRIGGER IF EXISTS `source_search_revision_update`;--> statement-breakpoint
CREATE TRIGGER source_search_revision_update
AFTER UPDATE OF content, title, status, scope_type, scope_id, created_by_user_id, external_uri, kind, connection_id ON resource
WHEN old.resource_type = 'source' AND (old.content IS NOT new.content OR old.title IS NOT new.title OR old.status IS NOT new.status
  OR old.project_id IS NOT new.project_id OR old.created_by_user_id IS NOT new.created_by_user_id
  OR old.external_uri IS NOT new.external_uri OR old.kind IS NOT new.kind OR old.connection_id IS NOT new.connection_id)
BEGIN
  UPDATE resource SET search_revision = old.search_revision + 1 WHERE resource_type = 'source' AND id = new.id;
  UPDATE search_document SET status = 'stale' WHERE document_type = 'source' AND resource_type = 'source' AND source_id = new.id;
END;--> statement-breakpoint
CREATE TRIGGER output_search_revision_update
AFTER UPDATE OF content, title, status, scope_type, scope_id, created_by_user_id, kind, deleted_at ON resource
WHEN old.resource_type = 'output' AND (old.content IS NOT new.content OR old.title IS NOT new.title OR old.status IS NOT new.status
  OR old.project_id IS NOT new.project_id OR old.created_by_user_id IS NOT new.created_by_user_id
  OR old.kind IS NOT new.kind OR old.deleted_at IS NOT new.deleted_at)
BEGIN
  UPDATE resource SET search_revision = old.search_revision + 1 WHERE resource_type = 'output' AND id = new.id;
  UPDATE search_document SET status = 'stale' WHERE document_type = 'source' AND resource_type = 'output' AND source_id = new.id;
END;--> statement-breakpoint
ALTER TABLE `source_knowledge_sync` ADD `checkpoint` text;--> statement-breakpoint
CREATE INDEX `resource_source_content_hash_idx` ON `resource` (`scope_id`, json_extract(`metadata`, '$.enrichments.relate.contentHash')) WHERE resource_type = 'source';--> statement-breakpoint
UPDATE resource SET metadata = json_set(
    json_remove(metadata, '$.resourceId', '$.upstreamRevision', '$.lastSyncedAt'),
    '$.upstream', json_patch(
      json_object('provider', COALESCE(provider, 'connector'), 'externalId', json_extract(metadata, '$.resourceId')),
      json_object('revision', json_extract(metadata, '$.upstreamRevision'), 'syncedAt', json_extract(metadata, '$.lastSyncedAt'))
    ),
    '$.origin', 'connector')
  WHERE resource_type = 'source' AND json_type(metadata, '$.syncId') = 'text' AND json_type(metadata, '$.resourceId') = 'text'
    AND json_extract(metadata, '$.immutableSnapshot') IS NOT 1
    AND NOT EXISTS (SELECT 1 FROM project_task_integration WHERE source_id = resource.id);--> statement-breakpoint
UPDATE resource SET metadata = json_set(metadata, '$.origin', CASE
    WHEN json_type(metadata, '$.knowledgeFeed') = 'object' AND json_extract(metadata, '$.knowledgeFeed.kind') = 'rss' THEN 'feed'
    WHEN json_type(metadata, '$.knowledgeFeed') = 'object' THEN 'topic'
    WHEN json_type(metadata, '$.generation') = 'object' THEN 'generated'
    WHEN kind = 'podcast' THEN 'generated'
    WHEN kind = 'repository' THEN 'repository'
    WHEN json_type(metadata, '$.uploadType') = 'text' THEN 'upload'
    WHEN json_type(metadata, '$.discoverSignal') = 'text' THEN 'research'
    WHEN kind = 'url' THEN 'page'
    WHEN kind = 'file' THEN 'upload'
    ELSE 'manual' END)
  WHERE resource_type = 'source' AND kind != 'memory' AND json_type(metadata, '$.origin') IS NULL
    AND json_extract(metadata, '$.immutableSnapshot') IS NOT 1
    AND NOT EXISTS (SELECT 1 FROM project_task_integration WHERE source_id = resource.id);
