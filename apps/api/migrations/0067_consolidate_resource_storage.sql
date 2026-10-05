CREATE TABLE "notification_endpoint" (
  "id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "token" TEXT,
  "environment" TEXT,
  "app_bundle_id" TEXT,
  "last_registered_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "invalidated_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "installation_id" TEXT,
  "platform" TEXT NOT NULL DEFAULT 'ios',
  "endpoint_hash" TEXT,
  "destination_json" TEXT,
  "state" TEXT DEFAULT 'registered',
  "failure_code" TEXT,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("platform", "id"),
  CHECK ((platform = 'ios' AND token IS NOT NULL AND environment IN ('sandbox','production') AND app_bundle_id IS NOT NULL AND last_registered_at IS NOT NULL AND installation_id IS NULL) OR (platform = 'web' AND installation_id IS NOT NULL AND endpoint_hash IS NOT NULL AND destination_json IS NOT NULL AND state IN ('registered','failed','disabled') AND token IS NULL)),
  CHECK ((platform = 'ios' AND id IS NOT NULL AND user_id IS NOT NULL AND token IS NOT NULL AND environment IS NOT NULL AND app_bundle_id IS NOT NULL AND last_registered_at IS NOT NULL AND created_at IS NOT NULL) OR (platform = 'web' AND id IS NOT NULL AND user_id IS NOT NULL AND installation_id IS NOT NULL AND platform IS NOT NULL AND endpoint_hash IS NOT NULL AND destination_json IS NOT NULL AND state IS NOT NULL AND created_at IS NOT NULL))
);
CREATE UNIQUE INDEX "notification_endpoint_token_idx" ON "notification_endpoint" ("token") WHERE token IS NOT NULL;
CREATE UNIQUE INDEX "notification_endpoint_owner_installation_idx" ON "notification_endpoint" ("user_id", "platform", "installation_id") WHERE platform = 'web';
CREATE UNIQUE INDEX "notification_endpoint_endpoint_idx" ON "notification_endpoint" ("platform", "endpoint_hash") WHERE platform = 'web';
CREATE INDEX "notification_endpoint_active_user_idx" ON "notification_endpoint" ("user_id", "invalidated_at") WHERE platform = 'ios';
CREATE INDEX "notification_endpoint_owner_platform_idx" ON "notification_endpoint" ("user_id", "platform", "updated_at") WHERE platform = 'web';
INSERT INTO "notification_endpoint" ("id", "user_id", "token", "environment", "app_bundle_id", "last_registered_at", "invalidated_at", "created_at", "platform")
SELECT "id", "user_id", "token", "environment", "app_bundle_id", "last_registered_at", "invalidated_at", "created_at", 'ios' FROM "mobile_push_device";
INSERT INTO "notification_endpoint" ("id", "user_id", "installation_id", "platform", "endpoint_hash", "destination_json", "state", "failure_code", "created_at", "updated_at")
SELECT "id", "user_id", "installation_id", "platform", "endpoint_hash", "destination_json", "state", "failure_code", "created_at", "updated_at" FROM "task_notification_registration";

--> statement-breakpoint
CREATE TABLE "delivery" (
  "id" TEXT NOT NULL,
  "device_id" TEXT,
  "status" TEXT,
  "error_code" TEXT,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "user_id" INTEGER REFERENCES "user"("id") ON DELETE CASCADE,
  "kind" TEXT,
  "scope_id" TEXT,
  "operation_id" TEXT,
  "payload_digest" TEXT,
  "payload_json" TEXT,
  "state" TEXT DEFAULT 'prepared',
  "execution_token" TEXT,
  "execution_lease_expires_at" TEXT,
  "sent_at" TEXT,
  "dedupe_key" TEXT,
  "registration_id" TEXT,
  "task_id" TEXT REFERENCES "project_task"("id") ON DELETE CASCADE,
  "task_version" INTEGER,
  "category" TEXT,
  "attempts" INTEGER DEFAULT 0,
  "provider_message_id" TEXT,
  "failure_code" TEXT,
  "next_attempt_at" TEXT,
  "endpoint_platform" TEXT GENERATED ALWAYS AS (CASE WHEN delivery_type = 'mobile' THEN 'ios' WHEN delivery_type = 'task' THEN 'web' END),
  "endpoint_id" TEXT GENERATED ALWAYS AS (COALESCE(device_id, registration_id)),
  "delivery_type" TEXT NOT NULL,
  FOREIGN KEY ("endpoint_platform", "endpoint_id") REFERENCES "notification_endpoint"("platform", "id") ON DELETE CASCADE,
  PRIMARY KEY ("delivery_type", "id"),
  CHECK ((delivery_type = 'mobile' AND device_id IS NOT NULL AND registration_id IS NULL AND operation_id IS NULL AND status IN ('sending','sent','failed')) OR (delivery_type = 'task' AND registration_id IS NOT NULL AND device_id IS NULL AND operation_id IS NULL AND user_id IS NOT NULL AND task_id IS NOT NULL AND task_version IS NOT NULL AND dedupe_key IS NOT NULL AND category IN ('decisions','failures','completions','assignments') AND status IN ('pending','delivered','failed','obsolete')) OR (delivery_type = 'outbound' AND device_id IS NULL AND registration_id IS NULL AND user_id IS NOT NULL AND kind IS NOT NULL AND scope_id IS NOT NULL AND operation_id IS NOT NULL AND payload_digest IS NOT NULL AND payload_json IS NOT NULL AND state IN ('prepared','sending','sent','indeterminate'))),
  CHECK ((delivery_type = 'mobile' AND id IS NOT NULL AND device_id IS NOT NULL AND status IS NOT NULL AND created_at IS NOT NULL) OR (delivery_type = 'task' AND id IS NOT NULL AND dedupe_key IS NOT NULL AND registration_id IS NOT NULL AND user_id IS NOT NULL AND task_id IS NOT NULL AND task_version IS NOT NULL AND category IS NOT NULL AND status IS NOT NULL AND attempts IS NOT NULL AND created_at IS NOT NULL) OR (delivery_type = 'outbound' AND id IS NOT NULL AND user_id IS NOT NULL AND kind IS NOT NULL AND scope_id IS NOT NULL AND operation_id IS NOT NULL AND payload_digest IS NOT NULL AND payload_json IS NOT NULL AND state IS NOT NULL AND created_at IS NOT NULL AND updated_at IS NOT NULL))
);
CREATE UNIQUE INDEX "delivery_dedupe_idx" ON "delivery" ("dedupe_key") WHERE delivery_type = 'task';
CREATE UNIQUE INDEX "delivery_outbound_operation_idx" ON "delivery" ("kind", "scope_id", "operation_id") WHERE delivery_type = 'outbound';
CREATE INDEX "delivery_endpoint_idx" ON "delivery" ("endpoint_platform", "endpoint_id");
CREATE INDEX "delivery_due_idx" ON "delivery" ("delivery_type", "status", "next_attempt_at") WHERE delivery_type = 'task';
CREATE INDEX "delivery_task_version_idx" ON "delivery" ("task_id", "task_version") WHERE task_id IS NOT NULL;
CREATE INDEX "delivery_outbound_owner_state_idx" ON "delivery" ("delivery_type", "user_id", "state") WHERE delivery_type = 'outbound';
INSERT INTO "delivery" ("id", "device_id", "status", "error_code", "created_at", "updated_at", "delivery_type")
SELECT "id", "device_id", "status", "error_code", "created_at", "updated_at", 'mobile' FROM "mobile_push_delivery";
INSERT INTO "delivery" ("id", "user_id", "kind", "scope_id", "operation_id", "payload_digest", "payload_json", "state", "execution_token", "execution_lease_expires_at", "created_at", "updated_at", "sent_at", "delivery_type")
SELECT "id", "user_id", "kind", "scope_id", "operation_id", "payload_digest", "payload_json", "state", "execution_token", "execution_lease_expires_at", "created_at", "updated_at", "sent_at", 'outbound' FROM "outbound_delivery";
INSERT INTO "delivery" ("id", "dedupe_key", "registration_id", "user_id", "task_id", "task_version", "category", "status", "attempts", "provider_message_id", "failure_code", "next_attempt_at", "created_at", "updated_at", "delivery_type")
SELECT "id", "dedupe_key", "registration_id", "user_id", "task_id", "task_version", "category", "status", "attempts", "provider_message_id", "failure_code", "next_attempt_at", "created_at", "updated_at", 'task' FROM "task_notification_delivery";

--> statement-breakpoint
CREATE TABLE "resource_revision" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  "document_id" TEXT REFERENCES "memory_document"("id") ON DELETE CASCADE,
  "revision" INTEGER NOT NULL,
  "text_content" TEXT DEFAULT '',
  "change_note" TEXT,
  "created_by" INTEGER REFERENCES "user"("id") ON DELETE NO ACTION,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "operation_id" TEXT,
  "skill_id" TEXT REFERENCES "authored_skill"("id") ON DELETE CASCADE,
  "description" TEXT,
  "digest" TEXT,
  "storage_key" TEXT,
  "size" INTEGER,
  "source_skill_id" TEXT,
  "source_revision_id" TEXT,
  "output_id" TEXT REFERENCES "output"("id") ON DELETE CASCADE,
  "title" TEXT,
  "status" TEXT,
  "sensitivity" TEXT,
  "content" TEXT,
  "created_by_user_id" INTEGER REFERENCES "user"("id") ON DELETE NO ACTION,
  "provenance_json" TEXT,
  "operation" TEXT,
  "restored_from_revision" INTEGER,
  "resource_type" TEXT NOT NULL,
  PRIMARY KEY ("resource_type", "id"),
  CHECK ((resource_type = 'memory' AND document_id IS NOT NULL AND skill_id IS NULL AND output_id IS NULL AND text_content IS NOT NULL AND created_by IS NOT NULL) OR (resource_type = 'skill' AND skill_id IS NOT NULL AND document_id IS NULL AND output_id IS NULL AND description IS NOT NULL AND digest IS NOT NULL AND storage_key IS NOT NULL AND size IS NOT NULL AND size >= 0 AND revision >= 1 AND created_by IS NOT NULL) OR (resource_type = 'output' AND output_id IS NOT NULL AND document_id IS NULL AND skill_id IS NULL AND title IS NOT NULL AND status IN ('pending','ready','failed','archived') AND sensitivity IN ('personal','internal','confidential') AND content IS NOT NULL AND created_by_user_id IS NOT NULL)),
  CHECK ((source_skill_id IS NULL AND source_revision_id IS NULL) OR (source_skill_id IS NOT NULL AND source_revision_id IS NOT NULL)),
  CHECK ((resource_type = 'memory' AND id IS NOT NULL AND document_id IS NOT NULL AND revision IS NOT NULL AND text_content IS NOT NULL AND created_by IS NOT NULL AND created_at IS NOT NULL) OR (resource_type = 'skill' AND id IS NOT NULL AND skill_id IS NOT NULL AND revision IS NOT NULL AND description IS NOT NULL AND digest IS NOT NULL AND storage_key IS NOT NULL AND size IS NOT NULL AND created_by IS NOT NULL AND created_at IS NOT NULL) OR (resource_type = 'output' AND output_id IS NOT NULL AND revision IS NOT NULL AND title IS NOT NULL AND status IS NOT NULL AND sensitivity IS NOT NULL AND content IS NOT NULL AND created_by_user_id IS NOT NULL AND created_at IS NOT NULL))
);
CREATE UNIQUE INDEX "resource_revision_memory_revision_idx" ON "resource_revision" ("document_id", "revision") WHERE document_id IS NOT NULL;
CREATE UNIQUE INDEX "resource_revision_memory_operation_idx" ON "resource_revision" ("document_id", "operation_id") WHERE document_id IS NOT NULL AND operation_id IS NOT NULL;
CREATE UNIQUE INDEX "resource_revision_skill_revision_idx" ON "resource_revision" ("skill_id", "revision") WHERE skill_id IS NOT NULL;
CREATE UNIQUE INDEX "resource_revision_output_revision_idx" ON "resource_revision" ("output_id", "revision") WHERE output_id IS NOT NULL;
CREATE UNIQUE INDEX "resource_revision_storage_key_idx" ON "resource_revision" ("storage_key") WHERE storage_key IS NOT NULL;
INSERT INTO "resource_revision" ("id", "document_id", "revision", "text_content", "change_note", "created_by", "created_at", "operation_id", "resource_type")
SELECT "id", "document_id", "revision", "content", "change_note", "created_by", "created_at", "operation_id", 'memory' FROM "memory_document_revision";
INSERT INTO "resource_revision" ("id", "skill_id", "revision", "description", "change_note", "digest", "storage_key", "size", "source_skill_id", "source_revision_id", "created_by", "created_at", "resource_type")
SELECT "id", "skill_id", "revision", "description", "change_note", "digest", "storage_key", "size", "source_skill_id", "source_revision_id", "created_by", "created_at", 'skill' FROM "authored_skill_revision";
INSERT INTO "resource_revision" ("output_id", "revision", "title", "status", "sensitivity", "content", "created_by_user_id", "created_at", "provenance_json", "operation", "restored_from_revision", "resource_type")
SELECT "output_id", "revision", "title", "status", "sensitivity", "content", "created_by_user_id", "created_at", "provenance_json", "operation", "restored_from_revision", 'output' FROM "output_revision";

--> statement-breakpoint
CREATE TABLE "user_resource_state" (
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
  PRIMARY KEY ("resource_type", "id"),
  CHECK ((resource_type = 'conversation' AND conversation_id IS NOT NULL AND message_id IS NULL AND task_id IS NULL) OR (resource_type = 'message' AND message_id IS NOT NULL AND saved_conversation_id IS NOT NULL AND conversation_id IS NULL AND task_id IS NULL) OR (resource_type = 'task' AND task_id IS NOT NULL AND task_version IS NOT NULL AND conversation_id IS NULL AND message_id IS NULL)),
  CHECK ((resource_type = 'message' AND id IS NOT NULL AND user_id IS NOT NULL AND saved_conversation_id IS NOT NULL AND message_id IS NOT NULL AND saved_at IS NOT NULL) OR (resource_type = 'conversation' AND conversation_id IS NOT NULL AND user_id IS NOT NULL AND is_pinned IS NOT NULL AND is_unread IS NOT NULL AND revision IS NOT NULL) OR (resource_type = 'task' AND user_id IS NOT NULL AND task_id IS NOT NULL AND task_version IS NOT NULL))
);
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
INSERT INTO "user_resource_state" ("id", "user_id", "saved_conversation_id", "message_id", "note", "saved_at", "resource_type")
SELECT "id", "user_id", "conversation_id", "message_id", "note", "saved_at", 'message' FROM "message_user_state";
INSERT INTO "user_resource_state" ("conversation_id", "user_id", "is_pinned", "is_unread", "snoozed_until", "snoozed_next_response_at", "revision", "updated_at", "resource_type")
SELECT "conversation_id", "user_id", "is_pinned", "is_unread", "snoozed_until", "snoozed_next_response_at", "revision", "updated_at", 'conversation' FROM "conversation_user_state";
INSERT INTO "user_resource_state" ("user_id", "task_id", "task_version", "read_at", "dismissed_at", "resource_type")
SELECT "user_id", "task_id", "task_version", "read_at", "dismissed_at", 'task' FROM "task_inbox_receipt";

--> statement-breakpoint
CREATE TABLE "project_task_integration" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
  "project_id" TEXT NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "task_id" TEXT NOT NULL REFERENCES "project_task"("id") ON DELETE CASCADE,
  "source_id" TEXT NOT NULL REFERENCES "source"("id") ON DELETE NO ACTION,
  "owner_user_id" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "provider" TEXT,
  "account_id" TEXT,
  "external_id" TEXT,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "target" TEXT,
  "policy_id" TEXT,
  "policy_revision" TEXT,
  "publication_status" TEXT DEFAULT 'unpublished',
  "publication_body" TEXT,
  "published_url" TEXT,
  "kind" TEXT NOT NULL,
  PRIMARY KEY ("kind", "id"),
  CHECK ((kind = 'import' AND provider IS NOT NULL AND account_id IS NOT NULL AND external_id IS NOT NULL AND target IS NULL) OR (kind = 'review' AND target IS NOT NULL AND provider IS NULL AND publication_status IN ('unpublished','publishing','published','unknown'))),
  CHECK ((kind = 'import' AND id IS NOT NULL AND workspace_id IS NOT NULL AND project_id IS NOT NULL AND task_id IS NOT NULL AND source_id IS NOT NULL AND owner_user_id IS NOT NULL AND provider IS NOT NULL AND account_id IS NOT NULL AND external_id IS NOT NULL AND created_at IS NOT NULL) OR (kind = 'review' AND id IS NOT NULL AND workspace_id IS NOT NULL AND project_id IS NOT NULL AND task_id IS NOT NULL AND source_id IS NOT NULL AND owner_user_id IS NOT NULL AND target IS NOT NULL AND publication_status IS NOT NULL AND created_at IS NOT NULL))
);
CREATE UNIQUE INDEX "project_task_integration_task_idx" ON "project_task_integration" ("task_id", "kind");
CREATE UNIQUE INDEX "project_task_integration_external_identity_idx" ON "project_task_integration" ("workspace_id", "project_id", "owner_user_id", "provider", "account_id", "external_id") WHERE kind = 'import';
CREATE INDEX "project_task_integration_project_created_idx" ON "project_task_integration" ("project_id", "kind", "created_at");
INSERT INTO "project_task_integration" ("id", "workspace_id", "project_id", "task_id", "source_id", "owner_user_id", "provider", "account_id", "external_id", "created_at", "kind")
SELECT "id", "workspace_id", "project_id", "task_id", "source_id", "owner_user_id", "provider", "account_id", "external_id", "created_at", 'import' FROM "project_task_external_import";
INSERT INTO "project_task_integration" ("id", "workspace_id", "project_id", "task_id", "source_id", "owner_user_id", "target", "policy_id", "policy_revision", "publication_status", "publication_body", "published_url", "created_at", "kind")
SELECT "id", "workspace_id", "project_id", "task_id", "source_id", "owner_user_id", "target", "policy_id", "policy_revision", "publication_status", "publication_body", "published_url", "created_at", 'review' FROM "project_task_review";

--> statement-breakpoint
CREATE TABLE __resource_storage_copy_check (valid INTEGER NOT NULL CHECK (valid = 1));
--> statement-breakpoint
INSERT INTO __resource_storage_copy_check SELECT (SELECT count(*) FROM mobile_push_device) = (SELECT count(*) FROM notification_endpoint WHERE platform = 'ios');
--> statement-breakpoint
INSERT INTO __resource_storage_copy_check SELECT (SELECT count(*) FROM task_notification_registration) = (SELECT count(*) FROM notification_endpoint WHERE platform = 'web');
--> statement-breakpoint
INSERT INTO __resource_storage_copy_check SELECT (SELECT count(*) FROM mobile_push_delivery) = (SELECT count(*) FROM delivery WHERE delivery_type = 'mobile');
--> statement-breakpoint
INSERT INTO __resource_storage_copy_check SELECT (SELECT count(*) FROM task_notification_delivery) = (SELECT count(*) FROM delivery WHERE delivery_type = 'task');
--> statement-breakpoint
INSERT INTO __resource_storage_copy_check SELECT (SELECT count(*) FROM outbound_delivery) = (SELECT count(*) FROM delivery WHERE delivery_type = 'outbound');
--> statement-breakpoint
INSERT INTO __resource_storage_copy_check SELECT (SELECT count(*) FROM memory_document_revision) = (SELECT count(*) FROM resource_revision WHERE resource_type = 'memory');
--> statement-breakpoint
INSERT INTO __resource_storage_copy_check SELECT (SELECT count(*) FROM authored_skill_revision) = (SELECT count(*) FROM resource_revision WHERE resource_type = 'skill');
--> statement-breakpoint
INSERT INTO __resource_storage_copy_check SELECT (SELECT count(*) FROM output_revision) = (SELECT count(*) FROM resource_revision WHERE resource_type = 'output');
--> statement-breakpoint
INSERT INTO __resource_storage_copy_check SELECT (SELECT count(*) FROM message_user_state) = (SELECT count(*) FROM user_resource_state WHERE resource_type = 'message');
--> statement-breakpoint
INSERT INTO __resource_storage_copy_check SELECT (SELECT count(*) FROM conversation_user_state) = (SELECT count(*) FROM user_resource_state WHERE resource_type = 'conversation');
--> statement-breakpoint
INSERT INTO __resource_storage_copy_check SELECT (SELECT count(*) FROM task_inbox_receipt) = (SELECT count(*) FROM user_resource_state WHERE resource_type = 'task');
--> statement-breakpoint
INSERT INTO __resource_storage_copy_check SELECT (SELECT count(*) FROM project_task_external_import) = (SELECT count(*) FROM project_task_integration WHERE kind = 'import');
--> statement-breakpoint
INSERT INTO __resource_storage_copy_check SELECT (SELECT count(*) FROM project_task_review) = (SELECT count(*) FROM project_task_integration WHERE kind = 'review');
--> statement-breakpoint
DROP TABLE __resource_storage_copy_check;
--> statement-breakpoint
DROP TABLE "mobile_push_delivery";

--> statement-breakpoint
DROP TABLE "task_notification_delivery";

--> statement-breakpoint
DROP TABLE "outbound_delivery";

--> statement-breakpoint
DROP TABLE "mobile_push_device";

--> statement-breakpoint
DROP TABLE "task_notification_registration";

--> statement-breakpoint
DROP TABLE "memory_document_revision";

--> statement-breakpoint
DROP TABLE "authored_skill_revision";

--> statement-breakpoint
DROP TABLE "output_revision";

--> statement-breakpoint
DROP TABLE "message_user_state";

--> statement-breakpoint
DROP TABLE "conversation_user_state";

--> statement-breakpoint
DROP TABLE "task_inbox_receipt";

--> statement-breakpoint
DROP TABLE "project_task_external_import";

--> statement-breakpoint
DROP TABLE "project_task_review";
