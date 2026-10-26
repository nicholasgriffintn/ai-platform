PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__new_resource_revision` (
	`id` text DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`document_id` text,
	`revision` integer NOT NULL,
	`text_content` text DEFAULT '',
	`change_note` text,
	`created_by` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`operation_id` text,
	`skill_id` text,
	`description` text,
	`digest` text,
	`storage_key` text,
	`size` integer,
	`source_skill_id` text,
	`source_revision_id` text,
	`output_id` text,
	`source_id` text,
	`title` text,
	`status` text,
	`sensitivity` text,
	`content` text,
	`created_by_user_id` integer,
	`provenance_json` text,
	`operation` text,
	`restored_from_revision` integer,
	`resource_type` text NOT NULL,
	PRIMARY KEY(`resource_type`, `id`),
	FOREIGN KEY (`document_id`) REFERENCES `resource`(`memory_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`skill_id`) REFERENCES `resource`(`skill_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`output_id`) REFERENCES `resource`(`output_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `resource`(`source_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "resource_revision_required_fields" CHECK((resource_type = 'memory' AND id IS NOT NULL AND document_id IS NOT NULL AND revision IS NOT NULL AND text_content IS NOT NULL AND created_by IS NOT NULL AND created_at IS NOT NULL) OR (resource_type = 'skill' AND id IS NOT NULL AND skill_id IS NOT NULL AND revision IS NOT NULL AND description IS NOT NULL AND digest IS NOT NULL AND storage_key IS NOT NULL AND size IS NOT NULL AND created_by IS NOT NULL AND created_at IS NOT NULL) OR (resource_type = 'output' AND output_id IS NOT NULL AND revision IS NOT NULL AND title IS NOT NULL AND status IS NOT NULL AND sensitivity IS NOT NULL AND content IS NOT NULL AND created_by_user_id IS NOT NULL AND created_at IS NOT NULL) OR (resource_type = 'source' AND source_id IS NOT NULL AND revision IS NOT NULL AND title IS NOT NULL AND text_content IS NOT NULL AND operation IS NOT NULL AND created_by_user_id IS NOT NULL AND created_at IS NOT NULL)),
	CONSTRAINT "resource_revision_shape_0" CHECK((resource_type = 'memory' AND document_id IS NOT NULL AND skill_id IS NULL AND output_id IS NULL AND source_id IS NULL AND text_content IS NOT NULL AND created_by IS NOT NULL) OR (resource_type = 'skill' AND skill_id IS NOT NULL AND document_id IS NULL AND output_id IS NULL AND source_id IS NULL AND description IS NOT NULL AND digest IS NOT NULL AND storage_key IS NOT NULL AND size IS NOT NULL AND size >= 0 AND revision >= 1 AND created_by IS NOT NULL) OR (resource_type = 'output' AND output_id IS NOT NULL AND document_id IS NULL AND skill_id IS NULL AND source_id IS NULL AND title IS NOT NULL AND status IN ('pending','ready','failed','archived') AND sensitivity IN ('personal','internal','confidential') AND content IS NOT NULL AND created_by_user_id IS NOT NULL) OR (resource_type = 'source' AND source_id IS NOT NULL AND document_id IS NULL AND skill_id IS NULL AND output_id IS NULL AND operation IN ('created','updated','restored') AND revision >= 1)),
	CONSTRAINT "resource_revision_shape_1" CHECK((source_skill_id IS NULL AND source_revision_id IS NULL) OR (source_skill_id IS NOT NULL AND source_revision_id IS NOT NULL))
);--> statement-breakpoint
INSERT INTO `__new_resource_revision` (`id`, `document_id`, `revision`, `text_content`, `change_note`, `created_by`, `created_at`, `operation_id`, `skill_id`, `description`, `digest`, `storage_key`, `size`, `source_skill_id`, `source_revision_id`, `output_id`, `title`, `status`, `sensitivity`, `content`, `created_by_user_id`, `provenance_json`, `operation`, `restored_from_revision`, `resource_type`)
SELECT `id`, `document_id`, `revision`, `text_content`, `change_note`, `created_by`, `created_at`, `operation_id`, `skill_id`, `description`, `digest`, `storage_key`, `size`, `source_skill_id`, `source_revision_id`, `output_id`, `title`, `status`, `sensitivity`, `content`, `created_by_user_id`, `provenance_json`, `operation`, `restored_from_revision`, `resource_type` FROM `resource_revision`;--> statement-breakpoint
DROP TABLE `resource_revision`;--> statement-breakpoint
ALTER TABLE `__new_resource_revision` RENAME TO `resource_revision`;--> statement-breakpoint
CREATE UNIQUE INDEX `resource_revision_memory_revision_idx` ON `resource_revision` (`document_id`,`revision`) WHERE document_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `resource_revision_memory_operation_idx` ON `resource_revision` (`document_id`,`operation_id`) WHERE document_id IS NOT NULL AND operation_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `resource_revision_skill_revision_idx` ON `resource_revision` (`skill_id`,`revision`) WHERE skill_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `resource_revision_output_revision_idx` ON `resource_revision` (`output_id`,`revision`) WHERE output_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `resource_revision_source_revision_idx` ON `resource_revision` (`source_id`,`revision`) WHERE source_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `resource_revision_source_session_idx` ON `resource_revision` (`source_id`,`operation_id`) WHERE source_id IS NOT NULL AND operation_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `resource_revision_storage_key_idx` ON `resource_revision` (`storage_key`) WHERE storage_key IS NOT NULL;--> statement-breakpoint
INSERT INTO resource (resource_type, id, created_by_user_id, scope_type, scope_id, kind, title, content, status, revision, search_revision, metadata, created_at, updated_at)
SELECT 'source', id, created_by_user_id, scope_type, scope_id, 'text',
  substr(COALESCE(NULLIF(trim(json_extract(content, '$.title')), ''), NULLIF(trim(title), ''), 'Untitled note'), 1, 200),
  COALESCE(json_extract(content, '$.content'), ''), 'available', 1, 1,
  CASE WHEN json_type(content, '$.metadata') = 'object'
    THEN json_object('origin', 'note', 'document', json(json_remove(json_extract(content, '$.metadata'),
      '$.themeMode', '$.fontFamily', '$.fontSize', '$.wordCount', '$.readingTime')))
    ELSE json_object('origin', 'note') END,
  created_at, COALESCE(updated_at, created_at)
FROM resource WHERE resource_type = 'output' AND capability_id = 'notes' AND kind = 'note';--> statement-breakpoint
INSERT OR IGNORE INTO resource_link (kind, collection_id, source_id)
SELECT 'source_collection', link.collection_id, link.output_id FROM resource_link link
JOIN resource note ON note.resource_type = 'output' AND note.id = link.output_id
WHERE link.kind = 'output_collection' AND note.capability_id = 'notes' AND note.kind = 'note';--> statement-breakpoint
DELETE FROM search_document WHERE document_type = 'source' AND resource_type = 'output'
  AND source_id IN (SELECT id FROM resource WHERE resource_type = 'output' AND capability_id = 'notes' AND kind = 'note');--> statement-breakpoint
DELETE FROM resource WHERE resource_type = 'output' AND capability_id = 'notes' AND kind = 'note';--> statement-breakpoint
INSERT OR IGNORE INTO resource_collection (id, collection_type, created_by_user_id, project_id, title, kind, created_at, updated_at)
SELECT 'articles-' || created_by_user_id || '-' || group_id, 'source', created_by_user_id, project_id,
  'Articles ' || date(MIN(created_at)), 'general', MIN(created_at), MAX(COALESCE(updated_at, created_at))
FROM resource WHERE resource_type = 'output' AND capability_id = 'articles' AND kind IN ('analysis', 'report') AND group_id IS NOT NULL
GROUP BY created_by_user_id, project_id, group_id;--> statement-breakpoint
INSERT INTO resource (resource_type, id, created_by_user_id, scope_type, scope_id, kind, title, content, status, revision, search_revision, metadata, created_at, updated_at)
SELECT 'source', id, created_by_user_id, scope_type, scope_id, 'text',
  substr(COALESCE(NULLIF(trim(replace(replace(title, 'Analysis: ', ''), '...', '')), ''), 'Article'), 1, 200),
  json_extract(content, '$.originalArticle'), 'available', 1, 1, json_object('origin', 'manual'),
  created_at, COALESCE(updated_at, created_at)
FROM resource WHERE resource_type = 'output' AND capability_id = 'articles' AND kind = 'analysis'
  AND length(trim(COALESCE(json_extract(content, '$.originalArticle'), ''))) > 0;--> statement-breakpoint
INSERT OR IGNORE INTO resource_link (kind, collection_id, source_id)
SELECT 'source_collection', 'articles-' || analysis.created_by_user_id || '-' || analysis.group_id, analysis.id
FROM resource analysis
WHERE analysis.resource_type = 'output' AND analysis.capability_id = 'articles' AND analysis.kind = 'analysis' AND analysis.group_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM resource filed WHERE filed.resource_type = 'source' AND filed.id = analysis.id);--> statement-breakpoint
UPDATE resource_revision SET content = json_object('format', 'markdown', 'body', COALESCE(json_extract(content, '$.report.content'), ''))
WHERE resource_type = 'output' AND output_id IN (
  SELECT id FROM resource WHERE resource_type = 'output' AND capability_id = 'articles' AND kind = 'report');--> statement-breakpoint
INSERT OR IGNORE INTO resource_link (kind, collection_id, output_id)
SELECT 'output_collection', 'articles-' || created_by_user_id || '-' || group_id, id
FROM resource WHERE resource_type = 'output' AND capability_id = 'articles' AND kind = 'report' AND group_id IS NOT NULL;--> statement-breakpoint
UPDATE resource SET kind = 'document', capability_id = 'document-writer',
  title = CASE WHEN title LIKE 'Report for Analysis Session %' THEN 'Article report' ELSE title END,
  content = json_object('format', 'markdown', 'body', COALESCE(json_extract(content, '$.report.content'), ''))
WHERE resource_type = 'output' AND capability_id = 'articles' AND kind = 'report';--> statement-breakpoint
DELETE FROM search_document WHERE document_type = 'source' AND resource_type = 'output'
  AND source_id IN (SELECT id FROM resource WHERE resource_type = 'output' AND capability_id = 'articles');--> statement-breakpoint
DELETE FROM resource WHERE resource_type = 'output' AND capability_id = 'articles';--> statement-breakpoint
DROP TRIGGER IF EXISTS `document_comment_authority_guard`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `document_comment_parent_guard`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `document_comment_revision_guard`;--> statement-breakpoint
CREATE TABLE `__new_document_comment` (
	`id` text PRIMARY KEY NOT NULL,
	`output_id` text,
	`source_id` text,
	`parent_id` text,
	`anchor_json` text,
	`source_revision` integer NOT NULL,
	`body` text NOT NULL,
	`author_user_id` integer NOT NULL,
	`resolved` integer DEFAULT false NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`mentioned_teammate_id` text,
	`task_id` text,
	`created_at` text NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`output_id`) REFERENCES `resource`(`output_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `resource`(`source_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `__new_document_comment`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "document_comment_source_revision_check" CHECK(`source_revision` > 0),
	CONSTRAINT "document_comment_revision_check" CHECK(`revision` > 0),
	CONSTRAINT "document_comment_subject_check" CHECK((`output_id` IS NULL) <> (`source_id` IS NULL))
);--> statement-breakpoint
INSERT INTO `__new_document_comment` (`id`, `output_id`, `parent_id`, `anchor_json`, `source_revision`, `body`, `author_user_id`, `resolved`, `revision`, `mentioned_teammate_id`, `task_id`, `created_at`, `updated_at`)
SELECT `id`, `output_id`, `parent_id`, `anchor_json`, `source_revision`, `body`, `author_user_id`, `resolved`, `revision`, `mentioned_teammate_id`, `task_id`, `created_at`, `updated_at` FROM `document_comment`;--> statement-breakpoint
DROP TABLE `document_comment`;--> statement-breakpoint
ALTER TABLE `__new_document_comment` RENAME TO `document_comment`;--> statement-breakpoint
CREATE INDEX `document_comment_output_idx` ON `document_comment` (`output_id`,`created_at`,`id`) WHERE output_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX `document_comment_source_idx` ON `document_comment` (`source_id`,`created_at`,`id`) WHERE source_id IS NOT NULL;--> statement-breakpoint
CREATE TRIGGER document_comment_authority_guard
BEFORE INSERT ON document_comment
WHEN NOT EXISTS (
  SELECT 1 FROM resource subject
  WHERE ((NEW.output_id IS NOT NULL AND subject.resource_type = 'output' AND subject.id = NEW.output_id)
      OR (NEW.source_id IS NOT NULL AND subject.resource_type = 'source' AND subject.id = NEW.source_id))
    AND ((subject.project_id IS NULL AND subject.created_by_user_id = NEW.author_user_id)
      OR EXISTS (SELECT 1 FROM project JOIN resource_grant member ON member.kind = 'membership' AND member.workspace_id = project.workspace_id
        WHERE project.id = subject.project_id AND member.user_id = NEW.author_user_id))
)
BEGIN
  SELECT RAISE(ABORT, 'document_access_revoked');
END;--> statement-breakpoint
CREATE TRIGGER document_comment_parent_guard
BEFORE INSERT ON document_comment
WHEN NEW.parent_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM document_comment
  WHERE id = NEW.parent_id AND output_id IS NEW.output_id AND source_id IS NEW.source_id AND parent_id IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'document_thread_conflict');
END;--> statement-breakpoint
CREATE TRIGGER document_comment_revision_guard
BEFORE INSERT ON document_comment
WHEN NOT EXISTS (
  SELECT 1 FROM resource subject
  WHERE ((NEW.output_id IS NOT NULL AND subject.resource_type = 'output' AND subject.id = NEW.output_id AND subject.kind = 'document')
      OR (NEW.source_id IS NOT NULL AND subject.resource_type = 'source' AND subject.id = NEW.source_id AND subject.kind = 'text'))
    AND subject.revision = NEW.source_revision
)
BEGIN
  SELECT RAISE(ABORT, 'document_revision_conflict');
END;
