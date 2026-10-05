ALTER TABLE "template" ADD COLUMN "publication_id" TEXT;
--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "source_teammate_id" TEXT REFERENCES "teammates"("id");
--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "avatar_url" TEXT;
--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "category" TEXT;
--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "tags" TEXT;
--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "is_featured" INTEGER DEFAULT false;
--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "is_public" INTEGER DEFAULT true;
--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "usage_count" INTEGER DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "rating_count" INTEGER DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "rating_average" TEXT DEFAULT '0';
--> statement-breakpoint
CREATE UNIQUE INDEX "template_publication_id_idx" ON "template" (publication_id);
--> statement-breakpoint
CREATE INDEX "template_publication_source_idx" ON "template" (source_teammate_id);
--> statement-breakpoint
CREATE INDEX "template_publication_category_idx" ON "template" (kind, is_public, category);
--> statement-breakpoint
CREATE INDEX "template_publication_featured_idx" ON "template" (kind, is_public, is_featured, usage_count);
--> statement-breakpoint
CREATE INDEX "template_publication_usage_idx" ON "template" (kind, is_public, usage_count, created_at);
--> statement-breakpoint
CREATE INDEX "template_publication_rating_idx" ON "template" (kind, is_public, CAST(rating_average AS REAL), rating_count, created_at);
--> statement-breakpoint
CREATE INDEX "template_publication_recent_idx" ON "template" (kind, is_public, created_at);
--> statement-breakpoint
WITH RECURSIVE prefix(value) AS (
  SELECT 'teammate-publication:'
  UNION ALL
  SELECT value || ':' FROM prefix
  WHERE EXISTS (SELECT 1 FROM template WHERE substr(id, 1, length(value)) = value)
)
INSERT INTO template (id, publication_id, kind, source_teammate_id, created_by_user_id, name, description, avatar_url, category, tags, is_featured, is_public, usage_count, rating_count, rating_average, configuration, created_at, updated_at)
SELECT (SELECT value FROM prefix WHERE NOT EXISTS (SELECT 1 FROM template WHERE substr(id, 1, length(value)) = value) LIMIT 1) || id,
 id, 'teammate_publication', teammate_id, user_id, name, description, avatar_url, category, tags, is_featured, is_public, usage_count, rating_count, rating_average, template_data, created_at, updated_at
FROM shared_teammates;
--> statement-breakpoint
CREATE TABLE "new_user_resource_state" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  "user_id" INTEGER NOT NULL,
  "saved_conversation_id" TEXT,
  "message_id" TEXT,
  "note" TEXT,
  "saved_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "conversation_id" TEXT REFERENCES "conversation"("id") ON DELETE CASCADE,
  "is_pinned" INTEGER DEFAULT false,
  "is_unread" INTEGER DEFAULT false,
  "snoozed_until" TEXT,
  "snoozed_next_response_at" TEXT,
  "revision" INTEGER DEFAULT 1,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "task_id" TEXT REFERENCES "project_task"("id") ON DELETE CASCADE,
  "task_version" INTEGER,
  "read_at" TEXT,
  "dismissed_at" TEXT,
  "resource_type" TEXT NOT NULL,
  "state_user_id" INTEGER GENERATED ALWAYS AS (CASE WHEN resource_type IN ('conversation', 'task') THEN user_id END) REFERENCES "user"("id") ON DELETE CASCADE,
  "saved_user_id" INTEGER GENERATED ALWAYS AS (CASE WHEN resource_type = 'message' THEN user_id END) REFERENCES "user"("id") ON DELETE NO ACTION,
  "teammate_id" TEXT,
  "publication_id" TEXT REFERENCES "template"("publication_id"),
  "feedback_conversation_id" TEXT,
  "rating" INTEGER,
  "verdict" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "feedback_teammate_id" TEXT GENERATED ALWAYS AS (CASE WHEN resource_type = 'teammate_feedback' THEN teammate_id END) REFERENCES "teammates"("id") ON DELETE CASCADE,
  "installed_teammate_id" TEXT GENERATED ALWAYS AS (CASE WHEN resource_type = 'teammate_install' THEN teammate_id END) REFERENCES "teammates"("id"),
  "teammate_user_id" INTEGER GENERATED ALWAYS AS (CASE WHEN resource_type IN ('teammate_install', 'teammate_rating', 'teammate_feedback') THEN user_id END) REFERENCES "user"("id"),
  PRIMARY KEY ("resource_type", "id"),
  CHECK ((resource_type = 'message' AND id IS NOT NULL AND user_id IS NOT NULL AND saved_conversation_id IS NOT NULL AND message_id IS NOT NULL AND saved_at IS NOT NULL) OR (resource_type = 'conversation' AND conversation_id IS NOT NULL AND user_id IS NOT NULL AND is_pinned IS NOT NULL AND is_unread IS NOT NULL AND revision IS NOT NULL) OR (resource_type = 'task' AND user_id IS NOT NULL AND task_id IS NOT NULL AND task_version IS NOT NULL) OR (resource_type = 'teammate_install' AND teammate_id IS NOT NULL AND publication_id IS NOT NULL AND created_at IS NOT NULL AND rating IS NULL AND verdict IS NULL AND feedback_conversation_id IS NULL) OR (resource_type = 'teammate_rating' AND publication_id IS NOT NULL AND rating IS NOT NULL AND created_at IS NOT NULL AND teammate_id IS NULL AND verdict IS NULL AND feedback_conversation_id IS NULL) OR (resource_type = 'teammate_feedback' AND teammate_id IS NOT NULL AND verdict IS NOT NULL AND created_at IS NOT NULL AND publication_id IS NULL AND rating IS NULL)),
  CHECK ((((resource_type = 'conversation' AND conversation_id IS NOT NULL AND message_id IS NULL AND task_id IS NULL) OR (resource_type = 'message' AND message_id IS NOT NULL AND saved_conversation_id IS NOT NULL AND conversation_id IS NULL AND task_id IS NULL) OR (resource_type = 'task' AND task_id IS NOT NULL AND task_version IS NOT NULL AND conversation_id IS NULL AND message_id IS NULL)) AND teammate_id IS NULL AND publication_id IS NULL AND rating IS NULL AND verdict IS NULL AND feedback_conversation_id IS NULL) OR (((resource_type = 'teammate_install' AND teammate_id IS NOT NULL AND publication_id IS NOT NULL AND created_at IS NOT NULL AND rating IS NULL AND verdict IS NULL AND feedback_conversation_id IS NULL) OR (resource_type = 'teammate_rating' AND publication_id IS NOT NULL AND rating IS NOT NULL AND created_at IS NOT NULL AND teammate_id IS NULL AND verdict IS NULL AND feedback_conversation_id IS NULL) OR (resource_type = 'teammate_feedback' AND teammate_id IS NOT NULL AND verdict IS NOT NULL AND created_at IS NOT NULL AND publication_id IS NULL AND rating IS NULL)) AND conversation_id IS NULL AND message_id IS NULL AND saved_conversation_id IS NULL AND task_id IS NULL))
);
--> statement-breakpoint
INSERT INTO new_user_resource_state ("id", "user_id", "saved_conversation_id", "message_id", "note", "saved_at", "conversation_id", "is_pinned", "is_unread", "snoozed_until", "snoozed_next_response_at", "revision", "updated_at", "task_id", "task_version", "read_at", "dismissed_at", "resource_type") SELECT "id", "user_id", "saved_conversation_id", "message_id", "note", "saved_at", "conversation_id", "is_pinned", "is_unread", "snoozed_until", "snoozed_next_response_at", "revision", "updated_at", "task_id", "task_version", "read_at", "dismissed_at", "resource_type" FROM user_resource_state;
--> statement-breakpoint
CREATE TABLE teammate_storage_copy_guard (valid INTEGER NOT NULL CHECK (valid = 1));
--> statement-breakpoint
INSERT INTO teammate_storage_copy_guard SELECT (SELECT count(*) FROM new_user_resource_state) = (SELECT count(*) FROM user_resource_state);
--> statement-breakpoint
DROP TABLE user_resource_state;
--> statement-breakpoint
ALTER TABLE new_user_resource_state RENAME TO user_resource_state;
--> statement-breakpoint
CREATE UNIQUE INDEX "user_resource_state_saved_message_idx" ON "user_resource_state" ("user_id", "message_id") WHERE message_id IS NOT NULL;
CREATE UNIQUE INDEX "user_resource_state_conversation_user_idx" ON "user_resource_state" ("conversation_id", "user_id") WHERE conversation_id IS NOT NULL;
CREATE UNIQUE INDEX "user_resource_state_task_receipt_idx" ON "user_resource_state" ("user_id", "task_id", "task_version") WHERE task_id IS NOT NULL;
CREATE INDEX "user_resource_state_saved_at_idx" ON "user_resource_state" ("resource_type", "user_id", "saved_at") WHERE resource_type = 'message';
CREATE INDEX "user_resource_state_pinned_idx" ON "user_resource_state" ("resource_type", "user_id", "is_pinned") WHERE resource_type = 'conversation';
CREATE INDEX "user_resource_state_unread_idx" ON "user_resource_state" ("resource_type", "user_id", "is_unread") WHERE resource_type = 'conversation';
CREATE INDEX "user_resource_state_snooze_idx" ON "user_resource_state" ("resource_type", "user_id", "snoozed_until") WHERE resource_type = 'conversation';
CREATE INDEX "user_resource_state_task_version_idx" ON "user_resource_state" ("task_id", "task_version") WHERE task_id IS NOT NULL;
CREATE INDEX "user_resource_state_state_owner_idx" ON "user_resource_state" ("state_user_id") WHERE state_user_id IS NOT NULL;
CREATE INDEX "user_resource_state_saved_owner_idx" ON "user_resource_state" ("saved_user_id") WHERE saved_user_id IS NOT NULL;

--> statement-breakpoint
CREATE INDEX "user_resource_state_publication_user_idx" ON user_resource_state (resource_type, publication_id, user_id);
--> statement-breakpoint
CREATE INDEX "user_resource_state_publication_recent_idx" ON user_resource_state (resource_type, publication_id, created_at);
--> statement-breakpoint
CREATE INDEX "user_resource_state_teammate_idx" ON user_resource_state (resource_type, teammate_id, user_id);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_resource_state_feedback_conversation_idx" ON user_resource_state (user_id, teammate_id, feedback_conversation_id) WHERE resource_type = 'teammate_feedback';
--> statement-breakpoint
CREATE INDEX "user_resource_state_feedback_owner_idx" ON user_resource_state (feedback_teammate_id);
--> statement-breakpoint
CREATE INDEX "user_resource_state_installed_owner_idx" ON user_resource_state (installed_teammate_id);
--> statement-breakpoint
CREATE INDEX "user_resource_state_teammate_user_idx" ON user_resource_state (teammate_user_id);
--> statement-breakpoint
CREATE INDEX "user_resource_state_publication_owner_idx" ON user_resource_state (publication_id);
--> statement-breakpoint
INSERT INTO user_resource_state (resource_type, id, user_id, publication_id, teammate_id, created_at)
SELECT 'teammate_install', id, user_id, shared_teammate_id, teammate_id, created_at FROM teammate_installs;
--> statement-breakpoint
INSERT INTO user_resource_state (resource_type, id, user_id, publication_id, rating, note, created_at, updated_at)
SELECT 'teammate_rating', id, user_id, shared_teammate_id, rating, review, created_at, updated_at FROM teammate_ratings;
--> statement-breakpoint
INSERT INTO user_resource_state (resource_type, id, user_id, teammate_id, feedback_conversation_id, verdict, note, created_at)
SELECT 'teammate_feedback', id, user_id, teammate_id, conversation_id, verdict, note, created_at FROM teammate_feedback;
--> statement-breakpoint
INSERT INTO teammate_storage_copy_guard SELECT (SELECT count(*) FROM shared_teammates) = (SELECT count(*) FROM template WHERE kind = 'teammate_publication');
--> statement-breakpoint
INSERT INTO teammate_storage_copy_guard SELECT (SELECT count(*) FROM teammate_installs) = (SELECT count(*) FROM user_resource_state WHERE resource_type = 'teammate_install');
--> statement-breakpoint
INSERT INTO teammate_storage_copy_guard SELECT (SELECT count(*) FROM teammate_ratings) = (SELECT count(*) FROM user_resource_state WHERE resource_type = 'teammate_rating');
--> statement-breakpoint
INSERT INTO teammate_storage_copy_guard SELECT (SELECT count(*) FROM teammate_feedback) = (SELECT count(*) FROM user_resource_state WHERE resource_type = 'teammate_feedback');
--> statement-breakpoint
DROP TABLE teammate_installs;
--> statement-breakpoint
DROP TABLE teammate_ratings;
--> statement-breakpoint
DROP TABLE teammate_feedback;
--> statement-breakpoint
DROP TABLE shared_teammates;
--> statement-breakpoint
DROP TABLE teammate_storage_copy_guard;
