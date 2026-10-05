PRAGMA defer_foreign_keys = ON;
--> statement-breakpoint
DROP TRIGGER "source_connection_deleted";
--> statement-breakpoint
DROP TRIGGER "source_knowledge_sync_deleted";
--> statement-breakpoint
DROP TRIGGER "document_comment_revision_guard";
--> statement-breakpoint
DROP TRIGGER "document_comment_parent_guard";
--> statement-breakpoint
DROP TRIGGER "source_task_snapshot_immutable";
--> statement-breakpoint
DROP TRIGGER "search_chunk_insert";
--> statement-breakpoint
DROP TRIGGER "search_chunk_delete";
--> statement-breakpoint
DROP TRIGGER "search_chunk_update";
--> statement-breakpoint
DROP TRIGGER "source_search_revision_update";
--> statement-breakpoint
DROP TRIGGER "source_search_revision_delete";
--> statement-breakpoint
DROP TRIGGER "document_comment_authority_guard";
--> statement-breakpoint
CREATE TABLE "__resource_stage_activity_record" AS SELECT "id", "created_by_user_id", "project_id", "conversation_id", "capability_id", "group_id", "kind", "status", "summary", "data", "created_at", "updated_at" FROM "activity_record";
--> statement-breakpoint
CREATE TABLE "__resource_stage_authored_skill" AS SELECT "id", "scope_type", "scope_id", "name", "created_by", "draft_revision_id", "stable_revision_id", "state_version", "archived_at", "created_at", "updated_at" FROM "authored_skill";
--> statement-breakpoint
CREATE TABLE "__resource_stage_browser_session" AS SELECT "id", "user_id", "conversation_id", "workspace_id", "provider", "credential_source", "provider_session_id", "tool_call_id", "input_hash", "creation_claimed", "creation_started_at", "last_error", "model", "destroyed_at", "created_at" FROM "browser_session";
--> statement-breakpoint
CREATE TABLE "__resource_stage_composio_connector_session" AS SELECT "id", "remote_session_id", "kind", "user_id", "provider", "toolkit_slug", "auth_config_id", "connected_account_id", "allowed_operation_ids", "run_id", "completion_id", "recipe_id", "installation_id", "state", "created_at", "expires_at", "claimed_at", "cleanup_attempts", "cleanup_after", "teammate_context_id", "project_id" FROM "composio_connector_session";
--> statement-breakpoint
CREATE TABLE "__resource_stage_conversation" AS SELECT "id", "user_id", "type", "title", "is_archived", "is_public", "share_id", "last_message_id", "last_message_at", "message_count", "parent_conversation_id", "parent_message_id", "project_id", "created_at", "updated_at", "model_id", "model_tier", "permission_mode", "brief_document_id", "group_id", "group_assigned_by_user_id", "group_assigned_at" FROM "conversation";
--> statement-breakpoint
CREATE TABLE "__resource_stage_conversation_run" AS SELECT "id", "conversation_id", "project_id", "project_task_id", "stage_id", "initiator_user_id", "status", "attempt", "event_sequence", "terminal_reason", "last_message_id", "context_json", "retry_json", "created_at", "updated_at", "started_at", "completed_at", "cancellation_requested_at", "provenance_json", "trigger", "interaction_kind", "teammate_context_id", "computer_id", "resolved_configuration_json" FROM "conversation_run";
--> statement-breakpoint
CREATE TABLE "__resource_stage_conversation_run_command" AS SELECT "id", "run_id", "user_id", "command_id", "kind", "input_digest", "accepted_at" FROM "conversation_run_command";
--> statement-breakpoint
CREATE TABLE "__resource_stage_conversation_run_event" AS SELECT "id", "run_id", "sequence", "protocol_version", "attempt", "type", "occurred_at", "data" FROM "conversation_run_event";
--> statement-breakpoint
CREATE TABLE "__resource_stage_delegation" AS SELECT "id", "parent_conversation_id", "child_conversation_id", "parent_run_id", "depth", "teammate_id", "goal", "wait_for", "max_credit_micros", "max_steps", "deadline", "state", "result_json", "created_at", "updated_at", "memory_bindings_json", "predecessor_delegation_id", "continuation_mode" FROM "delegation";
--> statement-breakpoint
CREATE TABLE "__resource_stage_delivery" AS SELECT "id", "device_id", "status", "error_code", "created_at", "updated_at", "user_id", "kind", "scope_id", "operation_id", "payload_digest", "payload_json", "state", "execution_token", "execution_lease_expires_at", "sent_at", "dedupe_key", "registration_id", "task_id", "task_version", "category", "attempts", "provider_message_id", "failure_code", "next_attempt_at", "delivery_type" FROM "delivery";
--> statement-breakpoint
CREATE TABLE "__resource_stage_document_comment" AS SELECT "id", "output_id", "parent_id", "anchor_json", "source_revision", "body", "author_user_id", "resolved", "revision", "mentioned_teammate_id", "task_id", "created_at", "updated_at" FROM "document_comment";
--> statement-breakpoint
CREATE TABLE "__resource_stage_goal" AS SELECT "id", "conversation_id", "sandbox_run_id", "user_id", "objective", "status", "source", "iteration_count", "stall_streak", "tokens_spent", "progress", "evidence", "stopped_reason", "created_from_message_id", "created_at", "updated_at", "completed_at", "last_continued_at" FROM "goal";
--> statement-breakpoint
CREATE TABLE "__resource_stage_memory_document" AS SELECT "id", "scope_type", "scope_id", "name", "content", "revision", "created_by", "deleted_at", "created_at", "updated_at", "kind" FROM "memory_document";
--> statement-breakpoint
CREATE TABLE "__resource_stage_memory_reflection" AS SELECT "record_kind", "id", "context_id", "conversation_id", "through_message_id", "revision", "status", "evidence_json", "created_at", "updated_at" FROM "memory_reflection";
--> statement-breakpoint
CREATE TABLE "__resource_stage_memory_syntheses" AS SELECT "id", "user_id", "synthesis_text", "synthesis_version", "memory_ids", "memory_count", "tokens_used", "namespace", "is_active", "superseded_by", "created_at", "updated_at" FROM "memory_syntheses";
--> statement-breakpoint
CREATE TABLE "__resource_stage_message" AS SELECT "id", "conversation_id", "parent_message_id", "is_archived", "role", "content", "parts", "name", "tool_calls", "citations", "model", "status", "timestamp", "platform", "mode", "log_id", "data", "usage", "tool_call_id", "tool_call_arguments", "app", "created_at", "updated_at", "run_id", "provenance_json" FROM "message";
--> statement-breakpoint
CREATE TABLE "__resource_stage_output" AS SELECT "id", "created_by_user_id", "project_id", "conversation_id", "parent_output_id", "capability_id", "group_id", "kind", "title", "status", "sensitivity", "content", "storage_key", "mime_type", "filename", "byte_size", "revision", "created_at", "updated_at", "provenance_json", "revision_created_by_user_id", "revision_created_at", "revision_operation", "restored_from_revision" FROM "output";
--> statement-breakpoint
CREATE TABLE "__resource_stage_project_task" AS SELECT "id", "project_id", "workspace_id", "objective", "acceptance_criteria", "expected_output", "context", "constraints", "depends_on_task_ids", "require_approval_for", "status", "source", "blocked_reason", "blocked_detail", "stage_id", "runner", "created_by_user_id", "assignee_user_id", "runner_identity_user_id", "conversation_id", "goal_id", "dispatch_task_id", "completions", "position", "token_budget", "tokens_spent", "created_at", "updated_at", "started_at", "completed_at", "flow_snapshot", "run_id", "attention_version", "origin_conversation_id", "execution_profile" FROM "project_task";
--> statement-breakpoint
CREATE TABLE "__resource_stage_project_task_integration" AS SELECT "id", "workspace_id", "project_id", "task_id", "source_id", "owner_user_id", "provider", "account_id", "external_id", "created_at", "target", "policy_id", "policy_revision", "publication_status", "publication_body", "published_url", "kind" FROM "project_task_integration";
--> statement-breakpoint
CREATE TABLE "__resource_stage_resource_grant" AS SELECT "kind", "id", "conversation_id", "delegation_id", "granted_by", "output_id", "token_hash", "permission", "created_by_user_id", "context_id", "connection_id", "allowed_operations", "revision", "expires_at", "revoked_at", "created_at", "updated_at", "workspace_id", "user_id", "role", "email", "status", "accepted_by", "accepted_at" FROM "resource_grant";
--> statement-breakpoint
CREATE TABLE "__resource_stage_resource_link" AS SELECT "kind", "output_id", "collection_id", "source_id", "from_version_id", "to_version_id", "relation", "created_at" FROM "resource_link";
--> statement-breakpoint
CREATE TABLE "__resource_stage_resource_revision" AS SELECT "id", "document_id", "revision", "text_content", "change_note", "created_by", "created_at", "operation_id", "skill_id", "description", "digest", "storage_key", "size", "source_skill_id", "source_revision_id", "output_id", "title", "status", "sensitivity", "content", "created_by_user_id", "provenance_json", "operation", "restored_from_revision", "resource_type" FROM "resource_revision";
--> statement-breakpoint
CREATE TABLE "__resource_stage_source" AS SELECT "id", "created_by_user_id", "project_id", "conversation_id", "connection_id", "kind", "title", "status", "content", "provider", "external_uri", "vector_id", "metadata", "storage_key", "mime_type", "filename", "byte_size", "created_at", "updated_at", "search_revision" FROM "source";
--> statement-breakpoint
CREATE TABLE "__resource_stage_teammate_computer" AS SELECT "id", "context_id", "provider", "provider_handle", "checkpoint_reference", "status", "lease_kind", "lease_owner_id", "lease_expires_at", "lease_fence", "last_error", "created_at", "updated_at" FROM "teammate_computer";
--> statement-breakpoint
CREATE TABLE "__resource_stage_teammate_context" AS SELECT "id", "teammate_id", "actor_user_id", "scope_type", "scope_id", "home_conversation_id", "memory_document_id", "status", "created_at", "updated_at" FROM "teammate_context";
--> statement-breakpoint
CREATE TABLE "__resource_stage_training_examples" AS SELECT "id", "user_id", "conversation_id", "source", "app_name", "user_prompt", "assistant_response", "system_prompt", "model_used", "feedback_rating", "feedback_comment", "metadata", "exported", "exported_at", "quality_score", "include_in_training", "task_category", "difficulty_level", "language_code", "user_prompt_tokens", "assistant_response_tokens", "response_time_ms", "conversation_turn", "conversation_context", "user_satisfaction_signals", "created_at", "updated_at" FROM "training_examples";
--> statement-breakpoint
CREATE TABLE "__resource_stage_usage_event" AS SELECT "id", "idempotency_key", "user_id", "workspace_id", "project_id", "conversation_id", "message_id", "activity_id", "completion_id", "occurred_at", "period", "source", "vendor", "resource", "unit", "quantity", "rate_version", "unit_cost_micros", "cost_micros", "credit_micros", "billable", "byok", "estimated", "raw", "created_at", "run_id", "run_attempt", "vendor_units", "reason", "site" FROM "usage_event";
--> statement-breakpoint
CREATE TABLE "__resource_stage_user_resource_state" AS SELECT "id", "user_id", "saved_conversation_id", "message_id", "note", "saved_at", "conversation_id", "is_pinned", "is_unread", "snoozed_until", "snoozed_next_response_at", "revision", "updated_at", "task_id", "task_version", "read_at", "dismissed_at", "resource_type", "teammate_id", "publication_id", "feedback_conversation_id", "rating", "verdict", "created_at" FROM "user_resource_state";
--> statement-breakpoint
DROP TABLE "activity_record";
--> statement-breakpoint
DROP TABLE "browser_session";
--> statement-breakpoint
DROP TABLE "composio_connector_session";
--> statement-breakpoint
DROP TABLE "conversation_run_command";
--> statement-breakpoint
DROP TABLE "conversation_run_event";
--> statement-breakpoint
DROP TABLE "delivery";
--> statement-breakpoint
DROP TABLE "document_comment";
--> statement-breakpoint
DROP TABLE "goal";
--> statement-breakpoint
DROP TABLE "memory_reflection";
--> statement-breakpoint
DROP TABLE "memory_syntheses";
--> statement-breakpoint
DROP TABLE "message";
--> statement-breakpoint
DROP TABLE "project_task_integration";
--> statement-breakpoint
DROP TABLE "resource_grant";
--> statement-breakpoint
DROP TABLE "resource_link";
--> statement-breakpoint
DROP TABLE "resource_revision";
--> statement-breakpoint
DROP TABLE "training_examples";
--> statement-breakpoint
DROP TABLE "usage_event";
--> statement-breakpoint
DROP TABLE "user_resource_state";
--> statement-breakpoint
DROP TABLE "authored_skill";
--> statement-breakpoint
DROP TABLE "delegation";
--> statement-breakpoint
DROP TABLE "output";
--> statement-breakpoint
DROP TABLE "project_task";
--> statement-breakpoint
DROP TABLE "source";
--> statement-breakpoint
DROP TABLE "conversation_run";
--> statement-breakpoint
DROP TABLE "teammate_computer";
--> statement-breakpoint
DROP TABLE "teammate_context";
--> statement-breakpoint
DROP TABLE "conversation";
--> statement-breakpoint
DROP TABLE "memory_document";
--> statement-breakpoint
CREATE TABLE `resource` (
	`resource_type` text NOT NULL,
	`id` text NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text NOT NULL,
	`project_id` text GENERATED ALWAYS AS (CASE WHEN scope_type = 'project' THEN scope_id END) VIRTUAL,
	`cascading_project_id` text GENERATED ALWAYS AS (CASE WHEN resource_type IN ('source', 'output') AND scope_type = 'project' THEN scope_id END) VIRTUAL,
	`source_id` text GENERATED ALWAYS AS (CASE WHEN resource_type = 'source' THEN id END) VIRTUAL,
	`output_id` text GENERATED ALWAYS AS (CASE WHEN resource_type = 'output' THEN id END) VIRTUAL,
	`memory_id` text GENERATED ALWAYS AS (CASE WHEN resource_type = 'memory' THEN id END) VIRTUAL,
	`skill_id` text GENERATED ALWAYS AS (CASE WHEN resource_type = 'skill' THEN id END) VIRTUAL,
	`conversation_id` text,
	`connection_id` text,
	`kind` text,
	`title` text,
	`content` text,
	`status` text,
	`revision` integer DEFAULT 1,
	`deleted_at` text,
	`archived_at` text,
	`storage_key` text,
	`mime_type` text,
	`filename` text,
	`byte_size` integer,
	`provider` text,
	`external_uri` text,
	`vector_id` text,
	`search_revision` integer DEFAULT 1,
	`metadata` text DEFAULT '{}',
	`parent_output_id` text,
	`capability_id` text,
	`group_id` text,
	`sensitivity` text,
	`provenance_json` text,
	`revision_created_by_user_id` integer,
	`revision_created_at` text,
	`revision_operation` text,
	`restored_from_revision` integer,
	`draft_revision_id` text,
	`stable_revision_id` text,
	`state_version` integer DEFAULT 1,
	`namespace` text DEFAULT 'global',
	`memory_ids` text,
	`memory_count` integer DEFAULT 0,
	`tokens_used` integer,
	`is_active` integer DEFAULT true,
	`superseded_by` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY(`resource_type`, `id`),
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cascading_project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`connection_id`) REFERENCES `provider_connection`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`revision_created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "resource_scope_check" CHECK(scope_type IN ('personal', 'project')),
	CONSTRAINT "resource_shape_check" CHECK((resource_type = 'source' AND kind IS NOT NULL AND title IS NOT NULL AND status IS NOT NULL AND search_revision IS NOT NULL AND metadata IS NOT NULL) OR (resource_type = 'output' AND kind IS NOT NULL AND title IS NOT NULL AND capability_id IS NOT NULL AND status IS NOT NULL AND sensitivity IS NOT NULL AND content IS NOT NULL AND revision IS NOT NULL) OR (resource_type = 'memory' AND kind IS NOT NULL AND title IS NOT NULL AND content IS NOT NULL AND revision IS NOT NULL AND updated_at IS NOT NULL) OR (resource_type = 'skill' AND title IS NOT NULL AND draft_revision_id IS NOT NULL AND stable_revision_id IS NOT NULL AND state_version IS NOT NULL AND state_version >= 1 AND updated_at IS NOT NULL) OR (resource_type = 'synthesis' AND content IS NOT NULL AND scope_type = 'personal'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_source_id_unique` ON `resource` (`source_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_output_id_unique` ON `resource` (`output_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_memory_id_unique` ON `resource` (`memory_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_skill_id_unique` ON `resource` (`skill_id`);
--> statement-breakpoint
CREATE INDEX `resource_scope_idx` ON `resource` (`resource_type`,`scope_type`,`scope_id`);
--> statement-breakpoint
CREATE INDEX `resource_creator_idx` ON `resource` (`resource_type`,`created_by_user_id`);
--> statement-breakpoint
CREATE INDEX `resource_project_idx` ON `resource` (`resource_type`,`project_id`);
--> statement-breakpoint
CREATE INDEX `resource_conversation_idx` ON `resource` (`resource_type`,`conversation_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_storage_idx` ON `resource` (`resource_type`,`storage_key`) WHERE storage_key IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_memory_name_idx` ON `resource` (`scope_type`,`scope_id`,`title`) WHERE resource_type = 'memory' AND deleted_at IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_skill_name_idx` ON `resource` (`scope_type`,`scope_id`,`title`) WHERE resource_type = 'skill' AND archived_at IS NULL;
--> statement-breakpoint
CREATE INDEX `resource_source_connection_idx` ON `resource` (`connection_id`) WHERE resource_type = 'source';
--> statement-breakpoint
CREATE INDEX `resource_source_kind_idx` ON `resource` (`kind`) WHERE resource_type = 'source';
--> statement-breakpoint
CREATE INDEX `resource_source_vector_idx` ON `resource` (`vector_id`) WHERE resource_type = 'source';
--> statement-breakpoint
CREATE INDEX `resource_output_parent_idx` ON `resource` (`parent_output_id`) WHERE resource_type = 'output';
--> statement-breakpoint
CREATE INDEX `resource_output_capability_idx` ON `resource` (`capability_id`) WHERE resource_type = 'output';
--> statement-breakpoint
CREATE INDEX `resource_output_group_idx` ON `resource` (`group_id`) WHERE resource_type = 'output';
--> statement-breakpoint
CREATE INDEX `resource_output_lookup_idx` ON `resource` (`created_by_user_id`,`capability_id`,`group_id`,`kind`) WHERE resource_type = 'output';
--> statement-breakpoint
CREATE INDEX `resource_synthesis_owner_idx` ON `resource` (`created_by_user_id`,`created_at`) WHERE resource_type = 'synthesis';
--> statement-breakpoint
CREATE INDEX `resource_synthesis_active_idx` ON `resource` (`created_by_user_id`,`namespace`,`is_active`,`created_at`) WHERE resource_type = 'synthesis';
--> statement-breakpoint
CREATE TABLE `activity_record` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`project_id` text,
	`conversation_id` text,
	`capability_id` text NOT NULL,
	`group_id` text,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`summary` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `activity_record_created_by_user_id_idx` ON `activity_record` (`created_by_user_id`);
--> statement-breakpoint
CREATE INDEX `activity_record_project_id_idx` ON `activity_record` (`project_id`);
--> statement-breakpoint
CREATE INDEX `activity_record_conversation_id_idx` ON `activity_record` (`conversation_id`);
--> statement-breakpoint
CREATE INDEX `activity_record_group_id_idx` ON `activity_record` (`group_id`);
--> statement-breakpoint
CREATE INDEX `activity_record_operational_idx` ON `activity_record` (`capability_id`,`status`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `browser_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`conversation_id` text NOT NULL,
	`workspace_id` text,
	`provider` text NOT NULL,
	`credential_source` text NOT NULL,
	`provider_session_id` text,
	`tool_call_id` text NOT NULL,
	`input_hash` text NOT NULL,
	`creation_claimed` integer DEFAULT 0 NOT NULL,
	`creation_started_at` integer,
	`last_error` text,
	`model` text NOT NULL,
	`destroyed_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "browser_session_credential_source" CHECK("browser_session"."credential_source" IN ('user', 'workspace'))
);
--> statement-breakpoint
CREATE INDEX `browser_session_conversation` ON `browser_session` (`conversation_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `browser_session_task_identity` ON `browser_session` (`user_id`,`conversation_id`,`tool_call_id`);
--> statement-breakpoint
CREATE TABLE `composio_connector_session` (
	`id` text PRIMARY KEY NOT NULL,
	`remote_session_id` text NOT NULL,
	`kind` text NOT NULL,
	`user_id` integer NOT NULL,
	`provider` text NOT NULL,
	`toolkit_slug` text NOT NULL,
	`auth_config_id` text,
	`connected_account_id` text,
	`allowed_operation_ids` text NOT NULL,
	`run_id` text NOT NULL,
	`completion_id` text,
	`recipe_id` text,
	`installation_id` text,
	`state` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`claimed_at` text,
	`cleanup_attempts` integer DEFAULT 0 NOT NULL,
	`cleanup_after` text, `teammate_context_id` text REFERENCES `teammate_context`(`id`) ON DELETE SET NULL, `project_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`installation_id`) REFERENCES `template`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `composio_connector_session_remote_session_id_unique` ON `composio_connector_session` (`remote_session_id`);
--> statement-breakpoint
CREATE INDEX `composio_connector_session_state_expiry_idx` ON `composio_connector_session` (`state`,`expires_at`);
--> statement-breakpoint
CREATE INDEX `composio_connector_session_state_cleanup_idx` ON `composio_connector_session` (`state`,`cleanup_after`);
--> statement-breakpoint
CREATE INDEX `composio_connector_session_owner_provider_idx` ON `composio_connector_session` (`user_id`,`provider`);
--> statement-breakpoint
CREATE INDEX `composio_connector_session_run_idx` ON `composio_connector_session` (`run_id`);
--> statement-breakpoint
CREATE TABLE `conversation` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`type` text DEFAULT 'chat' NOT NULL,
	`title` text DEFAULT 'New Conversation',
	`is_archived` integer DEFAULT false,
	`is_public` integer DEFAULT false,
	`share_id` text,
	`last_message_id` text,
	`last_message_at` text,
	`message_count` integer DEFAULT 0,
	`parent_conversation_id` text,
	`parent_message_id` text,
	`project_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP), `model_id` text, `model_tier` text, `permission_mode` text DEFAULT 'auto_accept_edits' NOT NULL, `brief_document_id` text REFERENCES "resource"("memory_id") ON DELETE SET NULL, group_id text REFERENCES resource_collection(id) ON DELETE SET NULL, group_assigned_by_user_id integer REFERENCES user(id), group_assigned_at text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_share_id_unique` ON `conversation` (`share_id`);
--> statement-breakpoint
CREATE INDEX `conversation_title_idx` ON `conversation` (`title`);
--> statement-breakpoint
CREATE INDEX `conversation_archived_idx` ON `conversation` (`is_archived`);
--> statement-breakpoint
CREATE INDEX `conversation_public_idx` ON `conversation` (`is_public`);
--> statement-breakpoint
CREATE INDEX `conversation_share_id_idx` ON `conversation` (`share_id`);
--> statement-breakpoint
CREATE INDEX `conversation_user_id_idx` ON `conversation` (`user_id`);
--> statement-breakpoint
CREATE INDEX `conversation_type_idx` ON `conversation` (`type`);
--> statement-breakpoint
CREATE INDEX `conversation_parent_conversation_id_idx` ON `conversation` (`parent_conversation_id`);
--> statement-breakpoint
CREATE INDEX `conversation_parent_message_id_idx` ON `conversation` (`parent_message_id`);
--> statement-breakpoint
CREATE INDEX `conversation_project_id_idx` ON `conversation` (`project_id`);
--> statement-breakpoint
CREATE INDEX `conversation_user_project_archived_updated_idx` ON `conversation` (`user_id`,`project_id`,`is_archived`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `conversation_brief_document_idx` ON `conversation` (`brief_document_id`);
--> statement-breakpoint
CREATE INDEX conversation_group_idx ON conversation(group_id);
--> statement-breakpoint
CREATE TABLE `conversation_run` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`project_id` text,
	`project_task_id` text,
	`stage_id` text,
	`initiator_user_id` integer NOT NULL,
	`status` text DEFAULT 'accepted' NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`event_sequence` integer DEFAULT 0 NOT NULL,
	`terminal_reason` text,
	`last_message_id` text,
	`context_json` text,
	`retry_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`started_at` text,
	`completed_at` text,
	`cancellation_requested_at` text, `provenance_json` text, `trigger` text DEFAULT 'user' NOT NULL, `interaction_kind` text, `teammate_context_id` text REFERENCES `teammate_context`(`id`) ON DELETE SET NULL, `computer_id` text REFERENCES "teammate_context"("computer_id") ON DELETE SET NULL, `resolved_configuration_json` text,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`initiator_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `conversation_run_conversation_updated_idx` ON `conversation_run` (`conversation_id`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `conversation_run_project_updated_idx` ON `conversation_run` (`project_id`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `conversation_run_project_task_idx` ON `conversation_run` (`project_task_id`);
--> statement-breakpoint
CREATE INDEX `conversation_run_initiator_idx` ON `conversation_run` (`initiator_user_id`);
--> statement-breakpoint
CREATE TABLE `conversation_run_command` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`command_id` text NOT NULL,
	`kind` text NOT NULL,
	`input_digest` text NOT NULL,
	`accepted_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `conversation_run`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_run_command_user_command_idx` ON `conversation_run_command` (`user_id`,`command_id`);
--> statement-breakpoint
CREATE INDEX `conversation_run_command_run_accepted_idx` ON `conversation_run_command` (`run_id`,`accepted_at`);
--> statement-breakpoint
CREATE TABLE `conversation_run_event` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`protocol_version` integer DEFAULT 1 NOT NULL,
	`attempt` integer NOT NULL,
	`type` text NOT NULL,
	`occurred_at` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `conversation_run`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_run_event_run_sequence_idx` ON `conversation_run_event` (`run_id`,`sequence`);
--> statement-breakpoint
CREATE INDEX `conversation_run_event_run_occurred_idx` ON `conversation_run_event` (`run_id`,`occurred_at`);
--> statement-breakpoint
CREATE TABLE `delegation` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_conversation_id` text NOT NULL,
	`child_conversation_id` text NOT NULL,
	`parent_run_id` text NOT NULL,
	`depth` integer NOT NULL,
	`teammate_id` text NOT NULL,
	`goal` text NOT NULL,
	`wait_for` text NOT NULL,
	`max_credit_micros` integer NOT NULL,
	`max_steps` integer NOT NULL,
	`deadline` text NOT NULL,
	`state` text DEFAULT 'queued' NOT NULL,
	`result_json` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP), `memory_bindings_json` text NOT NULL DEFAULT '[]', `predecessor_delegation_id` text, `continuation_mode` text NOT NULL DEFAULT 'new',
	FOREIGN KEY (`parent_conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_run_id`) REFERENCES `conversation_run`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `delegation_parent_conversation_idx` ON `delegation` (`parent_conversation_id`);
--> statement-breakpoint
CREATE INDEX `delegation_child_conversation_idx` ON `delegation` (`child_conversation_id`);
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
--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_dedupe_idx" ON "delivery" ("dedupe_key") WHERE delivery_type = 'task';
--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_outbound_operation_idx" ON "delivery" ("kind", "scope_id", "operation_id") WHERE delivery_type = 'outbound';
--> statement-breakpoint
CREATE INDEX "delivery_endpoint_idx" ON "delivery" ("endpoint_platform", "endpoint_id");
--> statement-breakpoint
CREATE INDEX "delivery_due_idx" ON "delivery" ("delivery_type", "status", "next_attempt_at") WHERE delivery_type = 'task';
--> statement-breakpoint
CREATE INDEX "delivery_task_version_idx" ON "delivery" ("task_id", "task_version") WHERE task_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "delivery_outbound_owner_state_idx" ON "delivery" ("delivery_type", "user_id", "state") WHERE delivery_type = 'outbound';
--> statement-breakpoint
CREATE TABLE `document_comment` (
	`id` text PRIMARY KEY NOT NULL,
	`output_id` text NOT NULL,
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
	FOREIGN KEY (`output_id`) REFERENCES "resource"("output_id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `document_comment`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "document_comment_source_revision_check" CHECK("document_comment"."source_revision" > 0),
	CONSTRAINT "document_comment_revision_check" CHECK("document_comment"."revision" > 0)
);
--> statement-breakpoint
CREATE INDEX `document_comment_output_idx` ON `document_comment` (`output_id`,`created_at`,`id`);
--> statement-breakpoint
CREATE TABLE `goal` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text,
	`sandbox_run_id` text,
	`user_id` integer NOT NULL,
	`objective` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`source` text DEFAULT 'user' NOT NULL,
	`iteration_count` integer DEFAULT 0 NOT NULL,
	`stall_streak` integer DEFAULT 0 NOT NULL,
	`tokens_spent` integer DEFAULT 0 NOT NULL,
	`progress` text,
	`evidence` text,
	`stopped_reason` text,
	`created_from_message_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	`completed_at` text,
	`last_continued_at` text,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "goal_owner_check" CHECK(("goal"."conversation_id" IS NULL) <> ("goal"."sandbox_run_id" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `goal_conversation_id_idx` ON `goal` (`conversation_id`);
--> statement-breakpoint
CREATE INDEX `goal_sandbox_run_id_idx` ON `goal` (`sandbox_run_id`);
--> statement-breakpoint
CREATE INDEX `goal_user_id_idx` ON `goal` (`user_id`);
--> statement-breakpoint
CREATE INDEX `goal_status_idx` ON `goal` (`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `goal_active_conversation_idx` ON `goal` (`conversation_id`) WHERE "goal"."status" IN ('active','paused') AND "goal"."conversation_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `goal_active_sandbox_run_idx` ON `goal` (`sandbox_run_id`) WHERE "goal"."status" IN ('active','paused') AND "goal"."sandbox_run_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE memory_reflection (
  record_kind TEXT NOT NULL,
  id TEXT NOT NULL,
  context_id TEXT NOT NULL REFERENCES teammate_context(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  through_message_id TEXT NOT NULL,
  revision INTEGER,
  status TEXT,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (record_kind, id),
  CHECK (record_kind = 'checkpoint' OR (record_kind = 'result' AND revision IS NOT NULL AND status IS NOT NULL AND status IN ('applied', 'no_change') AND evidence_json IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX memory_reflection_checkpoint_idx ON memory_reflection(context_id, conversation_id) WHERE record_kind = 'checkpoint';
--> statement-breakpoint
CREATE INDEX memory_reflection_context_idx ON memory_reflection(context_id);
--> statement-breakpoint
CREATE INDEX memory_reflection_conversation_idx ON memory_reflection(conversation_id);
--> statement-breakpoint
CREATE TABLE `message` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`parent_message_id` text,
	`is_archived` integer DEFAULT false,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`parts` text,
	`name` text,
	`tool_calls` text,
	`citations` text,
	`model` text,
	`status` text,
	`timestamp` integer,
	`platform` text,
	`mode` text,
	`log_id` text,
	`data` text,
	`usage` text,
	`tool_call_id` text,
	`tool_call_arguments` text,
	`app` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP), `run_id` text REFERENCES conversation_run(id), `provenance_json` text,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `message_conversation_id_idx` ON `message` (`conversation_id`);
--> statement-breakpoint
CREATE INDEX `message_archived_idx` ON `message` (`is_archived`);
--> statement-breakpoint
CREATE INDEX `message_parent_message_id_idx` ON `message` (`parent_message_id`);
--> statement-breakpoint
CREATE INDEX `message_role_idx` ON `message` (`role`);
--> statement-breakpoint
CREATE INDEX `message_run_id_idx` ON `message` (`run_id`);
--> statement-breakpoint
CREATE TABLE `project_task` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`objective` text NOT NULL,
	`acceptance_criteria` text,
	`expected_output` text,
	`context` text,
	`constraints` text,
	`depends_on_task_ids` text,
	`require_approval_for` text,
	`status` text DEFAULT 'backlog' NOT NULL,
	`source` text DEFAULT 'user' NOT NULL,
	`blocked_reason` text,
	`blocked_detail` text,
	`stage_id` text,
	`runner` text,
	`created_by_user_id` integer NOT NULL,
	`assignee_user_id` integer,
	`runner_identity_user_id` integer,
	`conversation_id` text,
	`goal_id` text,
	`dispatch_task_id` text,
	`completions` text,
	`position` real DEFAULT 0 NOT NULL,
	`token_budget` integer,
	`tokens_spent` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	`started_at` text,
	`completed_at` text, `flow_snapshot` text, `run_id` text REFERENCES conversation_run(id), `attention_version` integer DEFAULT 1 NOT NULL, `origin_conversation_id` text REFERENCES conversation(id), `execution_profile` text,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignee_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`runner_identity_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `project_task_project_status_idx` ON `project_task` (`project_id`,`status`,`position`);
--> statement-breakpoint
CREATE INDEX `project_task_workspace_status_idx` ON `project_task` (`workspace_id`,`status`);
--> statement-breakpoint
CREATE INDEX `project_task_assignee_idx` ON `project_task` (`assignee_user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_task_conversation_idx` ON `project_task` (`conversation_id`) WHERE "project_task"."conversation_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `project_task_run_idx` ON `project_task` (`run_id`);
--> statement-breakpoint
CREATE INDEX `project_task_origin_conversation_idx` ON `project_task` (`origin_conversation_id`);
--> statement-breakpoint
CREATE TABLE "project_task_integration" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
  "project_id" TEXT NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "task_id" TEXT NOT NULL REFERENCES "project_task"("id") ON DELETE CASCADE,
  "source_id" TEXT NOT NULL REFERENCES "resource"("source_id") ON DELETE NO ACTION,
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
--> statement-breakpoint
CREATE UNIQUE INDEX "project_task_integration_task_idx" ON "project_task_integration" ("task_id", "kind");
--> statement-breakpoint
CREATE UNIQUE INDEX "project_task_integration_external_identity_idx" ON "project_task_integration" ("workspace_id", "project_id", "owner_user_id", "provider", "account_id", "external_id") WHERE kind = 'import';
--> statement-breakpoint
CREATE INDEX "project_task_integration_project_created_idx" ON "project_task_integration" ("project_id", "kind", "created_at");
--> statement-breakpoint
CREATE INDEX project_task_integration_source_idx ON project_task_integration(source_id);
--> statement-breakpoint
CREATE TABLE "resource_grant" (
  kind text NOT NULL,
  id text NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  conversation_id text REFERENCES conversation(id) ON DELETE CASCADE,
  delegation_id text REFERENCES delegation(id) ON DELETE CASCADE,
  granted_by text,
  output_id text REFERENCES "resource"("output_id") ON DELETE CASCADE,
  token_hash text,
  permission text DEFAULT 'view',
  created_by_user_id integer REFERENCES user(id),
  context_id text REFERENCES teammate_context(id) ON DELETE CASCADE,
  connection_id text REFERENCES provider_connection(id) ON DELETE CASCADE,
  allowed_operations text,
  revision integer DEFAULT 1 NOT NULL,
  expires_at text,
  revoked_at text,
  created_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
  updated_at text DEFAULT (CURRENT_TIMESTAMP),
  workspace_id TEXT REFERENCES workspace(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES user(id) ON DELETE CASCADE,
  role TEXT,
  email TEXT,
  status TEXT,
  accepted_by INTEGER REFERENCES user(id),
  accepted_at TEXT,
  PRIMARY KEY (kind, id),
  CONSTRAINT resource_grant_shape_check CHECK (
      (kind = 'conversation' AND conversation_id IS NOT NULL AND delegation_id IS NOT NULL AND granted_by IS NOT NULL AND granted_by IN ('spawn', 'user') AND output_id IS NULL AND context_id IS NULL AND connection_id IS NULL AND token_hash IS NULL AND created_by_user_id IS NULL AND allowed_operations IS NULL)
      OR (kind = 'output' AND output_id IS NOT NULL AND token_hash IS NOT NULL AND permission IS NOT NULL AND created_by_user_id IS NOT NULL AND conversation_id IS NULL AND delegation_id IS NULL AND context_id IS NULL AND connection_id IS NULL AND granted_by IS NULL AND allowed_operations IS NULL)
      OR (kind = 'connection' AND context_id IS NOT NULL AND connection_id IS NOT NULL AND allowed_operations IS NOT NULL AND conversation_id IS NULL AND delegation_id IS NULL AND output_id IS NULL AND token_hash IS NULL AND created_by_user_id IS NULL AND granted_by IS NULL AND expires_at IS NULL AND revoked_at IS NULL)
      OR (kind IN ('membership', 'invitation') AND conversation_id IS NULL AND delegation_id IS NULL AND granted_by IS NULL AND output_id IS NULL AND context_id IS NULL AND connection_id IS NULL AND allowed_operations IS NULL)
    ),
  CONSTRAINT resource_grant_organisation_shape CHECK (
      (kind NOT IN ('membership', 'invitation') AND workspace_id IS NULL AND user_id IS NULL AND role IS NULL AND email IS NULL AND status IS NULL AND accepted_by IS NULL AND accepted_at IS NULL)
      OR (kind = 'membership' AND workspace_id IS NOT NULL AND user_id IS NOT NULL AND role IS NOT NULL AND email IS NULL AND status IS NULL AND accepted_by IS NULL AND accepted_at IS NULL AND created_by_user_id IS NULL AND token_hash IS NULL AND expires_at IS NULL AND revoked_at IS NULL)
      OR (kind = 'invitation' AND workspace_id IS NOT NULL AND user_id IS NULL AND role IS NOT NULL AND email IS NOT NULL AND status IS NOT NULL AND created_by_user_id IS NOT NULL AND token_hash IS NOT NULL AND expires_at IS NOT NULL)
    )
);
--> statement-breakpoint
CREATE UNIQUE INDEX resource_grant_delegation_idx ON resource_grant(delegation_id) WHERE delegation_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX resource_grant_conversation_idx ON resource_grant(conversation_id) WHERE conversation_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX resource_grant_token_idx ON resource_grant(kind, token_hash) WHERE token_hash IS NOT NULL;
--> statement-breakpoint
CREATE INDEX resource_grant_output_idx ON resource_grant(output_id) WHERE output_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX resource_grant_context_connection_idx ON resource_grant(context_id, connection_id) WHERE context_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX resource_grant_connection_idx ON resource_grant(connection_id) WHERE connection_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX resource_grant_membership_idx ON resource_grant(workspace_id,user_id) WHERE kind='membership';
--> statement-breakpoint
CREATE INDEX resource_grant_member_user_idx ON resource_grant(user_id,workspace_id) WHERE kind='membership';
--> statement-breakpoint
CREATE UNIQUE INDEX resource_grant_invitation_email_idx ON resource_grant(workspace_id,email) WHERE kind='invitation';
--> statement-breakpoint
CREATE INDEX resource_grant_invitation_status_idx ON resource_grant(workspace_id,status) WHERE kind='invitation';
--> statement-breakpoint
CREATE INDEX resource_grant_workspace_idx ON resource_grant(workspace_id);
--> statement-breakpoint
CREATE INDEX resource_grant_accepted_by_idx ON resource_grant(accepted_by);
--> statement-breakpoint
CREATE TABLE "resource_link" (
	`kind` text NOT NULL,
	`output_id` text,
	`collection_id` text,
	`source_id` text,
	`from_version_id` text,
	`to_version_id` text,
	`relation` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`output_id`) REFERENCES "resource"("output_id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collection_id`) REFERENCES `resource_collection`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES "resource"("source_id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_version_id`) REFERENCES "model_asset_version"(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_version_id`) REFERENCES "model_asset_version"(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "resource_link_shape_check" CHECK(("resource_link"."kind" = 'output_source' AND "resource_link"."output_id" IS NOT NULL AND "resource_link"."source_id" IS NOT NULL AND "resource_link"."collection_id" IS NULL AND "resource_link"."from_version_id" IS NULL AND "resource_link"."to_version_id" IS NULL AND "resource_link"."relation" IS NULL) OR ("resource_link"."kind" = 'source_collection' AND "resource_link"."collection_id" IS NOT NULL AND "resource_link"."source_id" IS NOT NULL AND "resource_link"."output_id" IS NULL AND "resource_link"."from_version_id" IS NULL AND "resource_link"."to_version_id" IS NULL AND "resource_link"."relation" IS NULL) OR ("resource_link"."kind" = 'model_lineage' AND "resource_link"."from_version_id" IS NOT NULL AND "resource_link"."to_version_id" IS NOT NULL AND "resource_link"."relation" IS NOT NULL AND "resource_link"."output_id" IS NULL AND "resource_link"."collection_id" IS NULL AND "resource_link"."source_id" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_link_output_source_idx` ON `resource_link` (`output_id`,`source_id`) WHERE "resource_link"."kind" = 'output_source';
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_link_collection_source_idx` ON `resource_link` (`collection_id`,`source_id`) WHERE "resource_link"."kind" = 'source_collection';
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_link_lineage_idx` ON `resource_link` (`from_version_id`,`to_version_id`,`relation`) WHERE "resource_link"."kind" = 'model_lineage';
--> statement-breakpoint
CREATE INDEX `resource_link_source_idx` ON `resource_link` (`kind`,`source_id`);
--> statement-breakpoint
CREATE INDEX `resource_link_lineage_target_idx` ON `resource_link` (`kind`,`to_version_id`);
--> statement-breakpoint
CREATE TABLE "resource_revision" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  "document_id" TEXT REFERENCES "resource"("memory_id") ON DELETE CASCADE,
  "revision" INTEGER NOT NULL,
  "text_content" TEXT DEFAULT '',
  "change_note" TEXT,
  "created_by" INTEGER REFERENCES "user"("id") ON DELETE NO ACTION,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "operation_id" TEXT,
  "skill_id" TEXT REFERENCES "resource"("skill_id") ON DELETE CASCADE,
  "description" TEXT,
  "digest" TEXT,
  "storage_key" TEXT,
  "size" INTEGER,
  "source_skill_id" TEXT,
  "source_revision_id" TEXT,
  "output_id" TEXT REFERENCES "resource"("output_id") ON DELETE CASCADE,
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
--> statement-breakpoint
CREATE UNIQUE INDEX "resource_revision_memory_revision_idx" ON "resource_revision" ("document_id", "revision") WHERE document_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "resource_revision_memory_operation_idx" ON "resource_revision" ("document_id", "operation_id") WHERE document_id IS NOT NULL AND operation_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "resource_revision_skill_revision_idx" ON "resource_revision" ("skill_id", "revision") WHERE skill_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "resource_revision_output_revision_idx" ON "resource_revision" ("output_id", "revision") WHERE output_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "resource_revision_storage_key_idx" ON "resource_revision" ("storage_key") WHERE storage_key IS NOT NULL;
--> statement-breakpoint
CREATE TABLE `teammate_computer` (
  `id` text PRIMARY KEY NOT NULL,
  `context_id` text NOT NULL REFERENCES `teammate_context`(`id`) ON DELETE CASCADE,
  `provider` text NOT NULL,
  `provider_handle` text,
  `checkpoint_reference` text,
  `status` text DEFAULT 'stopped' NOT NULL,
  `lease_kind` text,
  `lease_owner_id` text,
  `lease_expires_at` text,
  `lease_fence` integer DEFAULT 0 NOT NULL,
  `last_error` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teammate_computer_context_idx` ON `teammate_computer` (`context_id`);
--> statement-breakpoint
CREATE INDEX `teammate_computer_lease_idx` ON `teammate_computer` (`lease_expires_at`);
--> statement-breakpoint
CREATE TABLE `teammate_context` (
"computer_id" TEXT,
"computer_provider" TEXT,
"computer_provider_handle" TEXT,
"computer_checkpoint_reference" TEXT,
"computer_status" TEXT,
"computer_lease_kind" TEXT,
"computer_lease_owner_id" TEXT,
"computer_lease_expires_at" TEXT,
"computer_lease_fence" INTEGER,
"computer_last_error" TEXT,
"computer_created_at" TEXT,
"computer_updated_at" TEXT,
  `id` text PRIMARY KEY NOT NULL,
  `teammate_id` text NOT NULL REFERENCES `teammates`(`id`) ON DELETE CASCADE,
  `actor_user_id` integer NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `scope_type` text NOT NULL,
  `scope_id` text NOT NULL,
  `home_conversation_id` text NOT NULL REFERENCES `conversation`(`id`) ON DELETE CASCADE,
  `memory_document_id` text NOT NULL REFERENCES "resource"("memory_id") ON DELETE CASCADE,
  `status` text DEFAULT 'active' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT teammate_context_computer_shape_check CHECK (computer_id IS NULL OR (computer_provider IS NOT NULL AND computer_status IS NOT NULL AND computer_lease_fence IS NOT NULL AND computer_created_at IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teammate_context_identity_idx` ON `teammate_context` (`teammate_id`,`actor_user_id`,`scope_type`,`scope_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `teammate_context_home_conversation_idx` ON `teammate_context` (`home_conversation_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `teammate_context_memory_document_idx` ON `teammate_context` (`memory_document_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX teammate_context_computer_identity_idx ON teammate_context(computer_id);
--> statement-breakpoint
CREATE INDEX teammate_context_computer_lease_idx ON teammate_context(computer_lease_expires_at);
--> statement-breakpoint
CREATE TABLE `training_examples` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer,
	`conversation_id` text,
	`source` text NOT NULL,
	`app_name` text,
	`user_prompt` text NOT NULL,
	`assistant_response` text NOT NULL,
	`system_prompt` text,
	`model_used` text,
	`feedback_rating` integer,
	`feedback_comment` text,
	`metadata` text,
	`exported` integer DEFAULT false,
	`exported_at` text,
	`quality_score` integer,
	`include_in_training` integer DEFAULT true,
	`task_category` text,
	`difficulty_level` text,
	`language_code` text DEFAULT 'en',
	`user_prompt_tokens` integer,
	`assistant_response_tokens` integer,
	`response_time_ms` integer,
	`conversation_turn` integer DEFAULT 1,
	`conversation_context` text,
	`user_satisfaction_signals` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `training_examples_user_id_idx` ON `training_examples` (`user_id`);
--> statement-breakpoint
CREATE INDEX `training_examples_conversation_id_idx` ON `training_examples` (`conversation_id`);
--> statement-breakpoint
CREATE INDEX `training_examples_source_idx` ON `training_examples` (`source`);
--> statement-breakpoint
CREATE INDEX `training_examples_app_name_idx` ON `training_examples` (`app_name`);
--> statement-breakpoint
CREATE INDEX `training_examples_exported_idx` ON `training_examples` (`exported`);
--> statement-breakpoint
CREATE INDEX `training_examples_include_in_training_idx` ON `training_examples` (`include_in_training`);
--> statement-breakpoint
CREATE INDEX `training_examples_feedback_rating_idx` ON `training_examples` (`feedback_rating`);
--> statement-breakpoint
CREATE INDEX `training_examples_quality_score_idx` ON `training_examples` (`quality_score`);
--> statement-breakpoint
CREATE INDEX `training_examples_task_category_idx` ON `training_examples` (`task_category`);
--> statement-breakpoint
CREATE INDEX `training_examples_difficulty_level_idx` ON `training_examples` (`difficulty_level`);
--> statement-breakpoint
CREATE INDEX `training_examples_language_code_idx` ON `training_examples` (`language_code`);
--> statement-breakpoint
CREATE INDEX `training_examples_conversation_turn_idx` ON `training_examples` (`conversation_turn`);
--> statement-breakpoint
CREATE TABLE `usage_event` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`user_id` integer NOT NULL,
	`workspace_id` text,
	`project_id` text,
	`conversation_id` text,
	`message_id` text,
	`activity_id` text,
	`completion_id` text,
	`occurred_at` text NOT NULL,
	`period` text NOT NULL,
	`source` text NOT NULL,
	`vendor` text NOT NULL,
	`resource` text NOT NULL,
	`unit` text NOT NULL,
	`quantity` real NOT NULL,
	`rate_version` text,
	`unit_cost_micros` real,
	`cost_micros` integer DEFAULT 0 NOT NULL,
	`credit_micros` integer DEFAULT 0 NOT NULL,
	`billable` integer DEFAULT true NOT NULL,
	`byok` integer DEFAULT false NOT NULL,
	`estimated` integer DEFAULT false NOT NULL,
	`raw` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL, `run_id` text, `run_attempt` integer, `vendor_units` real, `reason` text, `site` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usage_event_idempotency_key_unique` ON `usage_event` (`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `usage_event_user_period_idx` ON `usage_event` (`user_id`,`period`);
--> statement-breakpoint
CREATE INDEX `usage_event_period_source_idx` ON `usage_event` (`period`,`source`);
--> statement-breakpoint
CREATE INDEX `usage_event_conversation_idx` ON `usage_event` (`conversation_id`);
--> statement-breakpoint
CREATE INDEX `usage_event_workspace_period_idx` ON `usage_event` (`workspace_id`,`period`);
--> statement-breakpoint
CREATE INDEX `usage_event_run_idx` ON `usage_event` (`run_id`,`run_attempt`);
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
CREATE UNIQUE INDEX "user_resource_state_saved_message_idx" ON "user_resource_state" ("user_id", "message_id") WHERE message_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "user_resource_state_conversation_user_idx" ON "user_resource_state" ("conversation_id", "user_id") WHERE conversation_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "user_resource_state_task_receipt_idx" ON "user_resource_state" ("user_id", "task_id", "task_version") WHERE task_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "user_resource_state_saved_at_idx" ON "user_resource_state" ("resource_type", "user_id", "saved_at") WHERE resource_type = 'message';
--> statement-breakpoint
CREATE INDEX "user_resource_state_pinned_idx" ON "user_resource_state" ("resource_type", "user_id", "is_pinned") WHERE resource_type = 'conversation';
--> statement-breakpoint
CREATE INDEX "user_resource_state_unread_idx" ON "user_resource_state" ("resource_type", "user_id", "is_unread") WHERE resource_type = 'conversation';
--> statement-breakpoint
CREATE INDEX "user_resource_state_snooze_idx" ON "user_resource_state" ("resource_type", "user_id", "snoozed_until") WHERE resource_type = 'conversation';
--> statement-breakpoint
CREATE INDEX "user_resource_state_task_version_idx" ON "user_resource_state" ("task_id", "task_version") WHERE task_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "user_resource_state_state_owner_idx" ON "user_resource_state" ("state_user_id") WHERE state_user_id IS NOT NULL;
--> statement-breakpoint
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
INSERT INTO resource (resource_type, "id", "created_by_user_id", "conversation_id", "connection_id", "kind", "title", "status", "content", "provider", "external_uri", "vector_id", "metadata", "storage_key", "mime_type", "filename", "byte_size", "created_at", "updated_at", "search_revision", "scope_type", "scope_id") SELECT 'source', "id", "created_by_user_id", "conversation_id", "connection_id", "kind", "title", "status", "content", "provider", "external_uri", "vector_id", "metadata", "storage_key", "mime_type", "filename", "byte_size", "created_at", "updated_at", "search_revision", CASE WHEN project_id IS NULL THEN 'personal' ELSE 'project' END, COALESCE(project_id, CAST(created_by_user_id AS TEXT)) FROM "__resource_stage_source";
--> statement-breakpoint
INSERT INTO resource (resource_type, "id", "created_by_user_id", "conversation_id", "parent_output_id", "capability_id", "group_id", "kind", "title", "status", "sensitivity", "content", "storage_key", "mime_type", "filename", "byte_size", "revision", "created_at", "updated_at", "provenance_json", "revision_created_by_user_id", "revision_created_at", "revision_operation", "restored_from_revision", "scope_type", "scope_id") SELECT 'output', "id", "created_by_user_id", "conversation_id", "parent_output_id", "capability_id", "group_id", "kind", "title", "status", "sensitivity", "content", "storage_key", "mime_type", "filename", "byte_size", "revision", "created_at", "updated_at", "provenance_json", "revision_created_by_user_id", "revision_created_at", "revision_operation", "restored_from_revision", CASE WHEN project_id IS NULL THEN 'personal' ELSE 'project' END, COALESCE(project_id, CAST(created_by_user_id AS TEXT)) FROM "__resource_stage_output";
--> statement-breakpoint
INSERT INTO resource (resource_type, "id", "scope_type", "scope_id", "title", "content", "revision", "created_by_user_id", "deleted_at", "created_at", "updated_at", "kind") SELECT 'memory', "id", "scope_type", "scope_id", "name", "content", "revision", "created_by", "deleted_at", "created_at", "updated_at", "kind" FROM "__resource_stage_memory_document";
--> statement-breakpoint
INSERT INTO resource (resource_type, "id", "scope_type", "scope_id", "title", "created_by_user_id", "draft_revision_id", "stable_revision_id", "state_version", "archived_at", "created_at", "updated_at") SELECT 'skill', "id", "scope_type", "scope_id", "name", "created_by", "draft_revision_id", "stable_revision_id", "state_version", "archived_at", "created_at", "updated_at" FROM "__resource_stage_authored_skill";
--> statement-breakpoint
INSERT INTO resource (resource_type, "id", "created_by_user_id", "content", "revision", "memory_ids", "memory_count", "tokens_used", "namespace", "is_active", "superseded_by", "created_at", "updated_at", "scope_type", "scope_id") SELECT 'synthesis', "id", "user_id", "synthesis_text", "synthesis_version", "memory_ids", "memory_count", "tokens_used", "namespace", "is_active", "superseded_by", "created_at", "updated_at", 'personal', CAST(user_id AS TEXT) FROM "__resource_stage_memory_syntheses";
--> statement-breakpoint
INSERT INTO "activity_record" ("id", "created_by_user_id", "project_id", "conversation_id", "capability_id", "group_id", "kind", "status", "summary", "data", "created_at", "updated_at") SELECT "id", "created_by_user_id", "project_id", "conversation_id", "capability_id", "group_id", "kind", "status", "summary", "data", "created_at", "updated_at" FROM "__resource_stage_activity_record";
--> statement-breakpoint
INSERT INTO "browser_session" ("id", "user_id", "conversation_id", "workspace_id", "provider", "credential_source", "provider_session_id", "tool_call_id", "input_hash", "creation_claimed", "creation_started_at", "last_error", "model", "destroyed_at", "created_at") SELECT "id", "user_id", "conversation_id", "workspace_id", "provider", "credential_source", "provider_session_id", "tool_call_id", "input_hash", "creation_claimed", "creation_started_at", "last_error", "model", "destroyed_at", "created_at" FROM "__resource_stage_browser_session";
--> statement-breakpoint
INSERT INTO "composio_connector_session" ("id", "remote_session_id", "kind", "user_id", "provider", "toolkit_slug", "auth_config_id", "connected_account_id", "allowed_operation_ids", "run_id", "completion_id", "recipe_id", "installation_id", "state", "created_at", "expires_at", "claimed_at", "cleanup_attempts", "cleanup_after", "teammate_context_id", "project_id") SELECT "id", "remote_session_id", "kind", "user_id", "provider", "toolkit_slug", "auth_config_id", "connected_account_id", "allowed_operation_ids", "run_id", "completion_id", "recipe_id", "installation_id", "state", "created_at", "expires_at", "claimed_at", "cleanup_attempts", "cleanup_after", "teammate_context_id", "project_id" FROM "__resource_stage_composio_connector_session";
--> statement-breakpoint
INSERT INTO "conversation" ("id", "user_id", "type", "title", "is_archived", "is_public", "share_id", "last_message_id", "last_message_at", "message_count", "parent_conversation_id", "parent_message_id", "project_id", "created_at", "updated_at", "model_id", "model_tier", "permission_mode", "brief_document_id", "group_id", "group_assigned_by_user_id", "group_assigned_at") SELECT "id", "user_id", "type", "title", "is_archived", "is_public", "share_id", "last_message_id", "last_message_at", "message_count", "parent_conversation_id", "parent_message_id", "project_id", "created_at", "updated_at", "model_id", "model_tier", "permission_mode", "brief_document_id", "group_id", "group_assigned_by_user_id", "group_assigned_at" FROM "__resource_stage_conversation";
--> statement-breakpoint
INSERT INTO "conversation_run" ("id", "conversation_id", "project_id", "project_task_id", "stage_id", "initiator_user_id", "status", "attempt", "event_sequence", "terminal_reason", "last_message_id", "context_json", "retry_json", "created_at", "updated_at", "started_at", "completed_at", "cancellation_requested_at", "provenance_json", "trigger", "interaction_kind", "teammate_context_id", "computer_id", "resolved_configuration_json") SELECT "id", "conversation_id", "project_id", "project_task_id", "stage_id", "initiator_user_id", "status", "attempt", "event_sequence", "terminal_reason", "last_message_id", "context_json", "retry_json", "created_at", "updated_at", "started_at", "completed_at", "cancellation_requested_at", "provenance_json", "trigger", "interaction_kind", "teammate_context_id", "computer_id", "resolved_configuration_json" FROM "__resource_stage_conversation_run";
--> statement-breakpoint
INSERT INTO "conversation_run_command" ("id", "run_id", "user_id", "command_id", "kind", "input_digest", "accepted_at") SELECT "id", "run_id", "user_id", "command_id", "kind", "input_digest", "accepted_at" FROM "__resource_stage_conversation_run_command";
--> statement-breakpoint
INSERT INTO "conversation_run_event" ("id", "run_id", "sequence", "protocol_version", "attempt", "type", "occurred_at", "data") SELECT "id", "run_id", "sequence", "protocol_version", "attempt", "type", "occurred_at", "data" FROM "__resource_stage_conversation_run_event";
--> statement-breakpoint
INSERT INTO "delegation" ("id", "parent_conversation_id", "child_conversation_id", "parent_run_id", "depth", "teammate_id", "goal", "wait_for", "max_credit_micros", "max_steps", "deadline", "state", "result_json", "created_at", "updated_at", "memory_bindings_json", "predecessor_delegation_id", "continuation_mode") SELECT "id", "parent_conversation_id", "child_conversation_id", "parent_run_id", "depth", "teammate_id", "goal", "wait_for", "max_credit_micros", "max_steps", "deadline", "state", "result_json", "created_at", "updated_at", "memory_bindings_json", "predecessor_delegation_id", "continuation_mode" FROM "__resource_stage_delegation";
--> statement-breakpoint
INSERT INTO "delivery" ("id", "device_id", "status", "error_code", "created_at", "updated_at", "user_id", "kind", "scope_id", "operation_id", "payload_digest", "payload_json", "state", "execution_token", "execution_lease_expires_at", "sent_at", "dedupe_key", "registration_id", "task_id", "task_version", "category", "attempts", "provider_message_id", "failure_code", "next_attempt_at", "delivery_type") SELECT "id", "device_id", "status", "error_code", "created_at", "updated_at", "user_id", "kind", "scope_id", "operation_id", "payload_digest", "payload_json", "state", "execution_token", "execution_lease_expires_at", "sent_at", "dedupe_key", "registration_id", "task_id", "task_version", "category", "attempts", "provider_message_id", "failure_code", "next_attempt_at", "delivery_type" FROM "__resource_stage_delivery";
--> statement-breakpoint
INSERT INTO "document_comment" ("id", "output_id", "parent_id", "anchor_json", "source_revision", "body", "author_user_id", "resolved", "revision", "mentioned_teammate_id", "task_id", "created_at", "updated_at") SELECT "id", "output_id", "parent_id", "anchor_json", "source_revision", "body", "author_user_id", "resolved", "revision", "mentioned_teammate_id", "task_id", "created_at", "updated_at" FROM "__resource_stage_document_comment";
--> statement-breakpoint
INSERT INTO "goal" ("id", "conversation_id", "sandbox_run_id", "user_id", "objective", "status", "source", "iteration_count", "stall_streak", "tokens_spent", "progress", "evidence", "stopped_reason", "created_from_message_id", "created_at", "updated_at", "completed_at", "last_continued_at") SELECT "id", "conversation_id", "sandbox_run_id", "user_id", "objective", "status", "source", "iteration_count", "stall_streak", "tokens_spent", "progress", "evidence", "stopped_reason", "created_from_message_id", "created_at", "updated_at", "completed_at", "last_continued_at" FROM "__resource_stage_goal";
--> statement-breakpoint
INSERT INTO "memory_reflection" ("record_kind", "id", "context_id", "conversation_id", "through_message_id", "revision", "status", "evidence_json", "created_at", "updated_at") SELECT "record_kind", "id", "context_id", "conversation_id", "through_message_id", "revision", "status", "evidence_json", "created_at", "updated_at" FROM "__resource_stage_memory_reflection";
--> statement-breakpoint
INSERT INTO "message" ("id", "conversation_id", "parent_message_id", "is_archived", "role", "content", "parts", "name", "tool_calls", "citations", "model", "status", "timestamp", "platform", "mode", "log_id", "data", "usage", "tool_call_id", "tool_call_arguments", "app", "created_at", "updated_at", "run_id", "provenance_json") SELECT "id", "conversation_id", "parent_message_id", "is_archived", "role", "content", "parts", "name", "tool_calls", "citations", "model", "status", "timestamp", "platform", "mode", "log_id", "data", "usage", "tool_call_id", "tool_call_arguments", "app", "created_at", "updated_at", "run_id", "provenance_json" FROM "__resource_stage_message";
--> statement-breakpoint
INSERT INTO "project_task" ("id", "project_id", "workspace_id", "objective", "acceptance_criteria", "expected_output", "context", "constraints", "depends_on_task_ids", "require_approval_for", "status", "source", "blocked_reason", "blocked_detail", "stage_id", "runner", "created_by_user_id", "assignee_user_id", "runner_identity_user_id", "conversation_id", "goal_id", "dispatch_task_id", "completions", "position", "token_budget", "tokens_spent", "created_at", "updated_at", "started_at", "completed_at", "flow_snapshot", "run_id", "attention_version", "origin_conversation_id", "execution_profile") SELECT "id", "project_id", "workspace_id", "objective", "acceptance_criteria", "expected_output", "context", "constraints", "depends_on_task_ids", "require_approval_for", "status", "source", "blocked_reason", "blocked_detail", "stage_id", "runner", "created_by_user_id", "assignee_user_id", "runner_identity_user_id", "conversation_id", "goal_id", "dispatch_task_id", "completions", "position", "token_budget", "tokens_spent", "created_at", "updated_at", "started_at", "completed_at", "flow_snapshot", "run_id", "attention_version", "origin_conversation_id", "execution_profile" FROM "__resource_stage_project_task";
--> statement-breakpoint
INSERT INTO "project_task_integration" ("id", "workspace_id", "project_id", "task_id", "source_id", "owner_user_id", "provider", "account_id", "external_id", "created_at", "target", "policy_id", "policy_revision", "publication_status", "publication_body", "published_url", "kind") SELECT "id", "workspace_id", "project_id", "task_id", "source_id", "owner_user_id", "provider", "account_id", "external_id", "created_at", "target", "policy_id", "policy_revision", "publication_status", "publication_body", "published_url", "kind" FROM "__resource_stage_project_task_integration";
--> statement-breakpoint
INSERT INTO "resource_grant" ("kind", "id", "conversation_id", "delegation_id", "granted_by", "output_id", "token_hash", "permission", "created_by_user_id", "context_id", "connection_id", "allowed_operations", "revision", "expires_at", "revoked_at", "created_at", "updated_at", "workspace_id", "user_id", "role", "email", "status", "accepted_by", "accepted_at") SELECT "kind", "id", "conversation_id", "delegation_id", "granted_by", "output_id", "token_hash", "permission", "created_by_user_id", "context_id", "connection_id", "allowed_operations", "revision", "expires_at", "revoked_at", "created_at", "updated_at", "workspace_id", "user_id", "role", "email", "status", "accepted_by", "accepted_at" FROM "__resource_stage_resource_grant";
--> statement-breakpoint
INSERT INTO "resource_link" ("kind", "output_id", "collection_id", "source_id", "from_version_id", "to_version_id", "relation", "created_at") SELECT "kind", "output_id", "collection_id", "source_id", "from_version_id", "to_version_id", "relation", "created_at" FROM "__resource_stage_resource_link";
--> statement-breakpoint
INSERT INTO "resource_revision" ("id", "document_id", "revision", "text_content", "change_note", "created_by", "created_at", "operation_id", "skill_id", "description", "digest", "storage_key", "size", "source_skill_id", "source_revision_id", "output_id", "title", "status", "sensitivity", "content", "created_by_user_id", "provenance_json", "operation", "restored_from_revision", "resource_type") SELECT "id", "document_id", "revision", "text_content", "change_note", "created_by", "created_at", "operation_id", "skill_id", "description", "digest", "storage_key", "size", "source_skill_id", "source_revision_id", "output_id", "title", "status", "sensitivity", "content", "created_by_user_id", "provenance_json", "operation", "restored_from_revision", "resource_type" FROM "__resource_stage_resource_revision";
--> statement-breakpoint
INSERT INTO "teammate_computer" ("id", "context_id", "provider", "provider_handle", "checkpoint_reference", "status", "lease_kind", "lease_owner_id", "lease_expires_at", "lease_fence", "last_error", "created_at", "updated_at") SELECT "id", "context_id", "provider", "provider_handle", "checkpoint_reference", "status", "lease_kind", "lease_owner_id", "lease_expires_at", "lease_fence", "last_error", "created_at", "updated_at" FROM "__resource_stage_teammate_computer";
--> statement-breakpoint
INSERT INTO "teammate_context" ("id", "teammate_id", "actor_user_id", "scope_type", "scope_id", "home_conversation_id", "memory_document_id", "status", "created_at", "updated_at") SELECT "id", "teammate_id", "actor_user_id", "scope_type", "scope_id", "home_conversation_id", "memory_document_id", "status", "created_at", "updated_at" FROM "__resource_stage_teammate_context";
--> statement-breakpoint
INSERT INTO "training_examples" ("id", "user_id", "conversation_id", "source", "app_name", "user_prompt", "assistant_response", "system_prompt", "model_used", "feedback_rating", "feedback_comment", "metadata", "exported", "exported_at", "quality_score", "include_in_training", "task_category", "difficulty_level", "language_code", "user_prompt_tokens", "assistant_response_tokens", "response_time_ms", "conversation_turn", "conversation_context", "user_satisfaction_signals", "created_at", "updated_at") SELECT "id", "user_id", "conversation_id", "source", "app_name", "user_prompt", "assistant_response", "system_prompt", "model_used", "feedback_rating", "feedback_comment", "metadata", "exported", "exported_at", "quality_score", "include_in_training", "task_category", "difficulty_level", "language_code", "user_prompt_tokens", "assistant_response_tokens", "response_time_ms", "conversation_turn", "conversation_context", "user_satisfaction_signals", "created_at", "updated_at" FROM "__resource_stage_training_examples";
--> statement-breakpoint
INSERT INTO "usage_event" ("id", "idempotency_key", "user_id", "workspace_id", "project_id", "conversation_id", "message_id", "activity_id", "completion_id", "occurred_at", "period", "source", "vendor", "resource", "unit", "quantity", "rate_version", "unit_cost_micros", "cost_micros", "credit_micros", "billable", "byok", "estimated", "raw", "created_at", "run_id", "run_attempt", "vendor_units", "reason", "site") SELECT "id", "idempotency_key", "user_id", "workspace_id", "project_id", "conversation_id", "message_id", "activity_id", "completion_id", "occurred_at", "period", "source", "vendor", "resource", "unit", "quantity", "rate_version", "unit_cost_micros", "cost_micros", "credit_micros", "billable", "byok", "estimated", "raw", "created_at", "run_id", "run_attempt", "vendor_units", "reason", "site" FROM "__resource_stage_usage_event";
--> statement-breakpoint
INSERT INTO "user_resource_state" ("id", "user_id", "saved_conversation_id", "message_id", "note", "saved_at", "conversation_id", "is_pinned", "is_unread", "snoozed_until", "snoozed_next_response_at", "revision", "updated_at", "task_id", "task_version", "read_at", "dismissed_at", "resource_type", "teammate_id", "publication_id", "feedback_conversation_id", "rating", "verdict", "created_at") SELECT "id", "user_id", "saved_conversation_id", "message_id", "note", "saved_at", "conversation_id", "is_pinned", "is_unread", "snoozed_until", "snoozed_next_response_at", "revision", "updated_at", "task_id", "task_version", "read_at", "dismissed_at", "resource_type", "teammate_id", "publication_id", "feedback_conversation_id", "rating", "verdict", "created_at" FROM "__resource_stage_user_resource_state";
--> statement-breakpoint
UPDATE teammate_context SET computer_id = (SELECT "id" FROM teammate_computer WHERE context_id = teammate_context.id), computer_provider = (SELECT "provider" FROM teammate_computer WHERE context_id = teammate_context.id), computer_provider_handle = (SELECT "provider_handle" FROM teammate_computer WHERE context_id = teammate_context.id), computer_checkpoint_reference = (SELECT "checkpoint_reference" FROM teammate_computer WHERE context_id = teammate_context.id), computer_status = (SELECT "status" FROM teammate_computer WHERE context_id = teammate_context.id), computer_lease_kind = (SELECT "lease_kind" FROM teammate_computer WHERE context_id = teammate_context.id), computer_lease_owner_id = (SELECT "lease_owner_id" FROM teammate_computer WHERE context_id = teammate_context.id), computer_lease_expires_at = (SELECT "lease_expires_at" FROM teammate_computer WHERE context_id = teammate_context.id), computer_lease_fence = (SELECT "lease_fence" FROM teammate_computer WHERE context_id = teammate_context.id), computer_last_error = (SELECT "last_error" FROM teammate_computer WHERE context_id = teammate_context.id), computer_created_at = (SELECT "created_at" FROM teammate_computer WHERE context_id = teammate_context.id), computer_updated_at = (SELECT "updated_at" FROM teammate_computer WHERE context_id = teammate_context.id) WHERE EXISTS (SELECT 1 FROM teammate_computer WHERE context_id = teammate_context.id);
--> statement-breakpoint
CREATE TABLE __resource_copy_check (valid INTEGER NOT NULL CHECK (valid = 1));
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "activity_record") = (SELECT count(*) FROM "__resource_stage_activity_record") AND NOT EXISTS (SELECT "id", "created_by_user_id", "project_id", "conversation_id", "capability_id", "group_id", "kind", "status", "summary", "data", "created_at", "updated_at" FROM "__resource_stage_activity_record" EXCEPT SELECT "id", "created_by_user_id", "project_id", "conversation_id", "capability_id", "group_id", "kind", "status", "summary", "data", "created_at", "updated_at" FROM "activity_record");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "browser_session") = (SELECT count(*) FROM "__resource_stage_browser_session") AND NOT EXISTS (SELECT "id", "user_id", "conversation_id", "workspace_id", "provider", "credential_source", "provider_session_id", "tool_call_id", "input_hash", "creation_claimed", "creation_started_at", "last_error", "model", "destroyed_at", "created_at" FROM "__resource_stage_browser_session" EXCEPT SELECT "id", "user_id", "conversation_id", "workspace_id", "provider", "credential_source", "provider_session_id", "tool_call_id", "input_hash", "creation_claimed", "creation_started_at", "last_error", "model", "destroyed_at", "created_at" FROM "browser_session");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "composio_connector_session") = (SELECT count(*) FROM "__resource_stage_composio_connector_session") AND NOT EXISTS (SELECT "id", "remote_session_id", "kind", "user_id", "provider", "toolkit_slug", "auth_config_id", "connected_account_id", "allowed_operation_ids", "run_id", "completion_id", "recipe_id", "installation_id", "state", "created_at", "expires_at", "claimed_at", "cleanup_attempts", "cleanup_after", "teammate_context_id", "project_id" FROM "__resource_stage_composio_connector_session" EXCEPT SELECT "id", "remote_session_id", "kind", "user_id", "provider", "toolkit_slug", "auth_config_id", "connected_account_id", "allowed_operation_ids", "run_id", "completion_id", "recipe_id", "installation_id", "state", "created_at", "expires_at", "claimed_at", "cleanup_attempts", "cleanup_after", "teammate_context_id", "project_id" FROM "composio_connector_session");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "conversation") = (SELECT count(*) FROM "__resource_stage_conversation") AND NOT EXISTS (SELECT "id", "user_id", "type", "title", "is_archived", "is_public", "share_id", "last_message_id", "last_message_at", "message_count", "parent_conversation_id", "parent_message_id", "project_id", "created_at", "updated_at", "model_id", "model_tier", "permission_mode", "brief_document_id", "group_id", "group_assigned_by_user_id", "group_assigned_at" FROM "__resource_stage_conversation" EXCEPT SELECT "id", "user_id", "type", "title", "is_archived", "is_public", "share_id", "last_message_id", "last_message_at", "message_count", "parent_conversation_id", "parent_message_id", "project_id", "created_at", "updated_at", "model_id", "model_tier", "permission_mode", "brief_document_id", "group_id", "group_assigned_by_user_id", "group_assigned_at" FROM "conversation");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "conversation_run") = (SELECT count(*) FROM "__resource_stage_conversation_run") AND NOT EXISTS (SELECT "id", "conversation_id", "project_id", "project_task_id", "stage_id", "initiator_user_id", "status", "attempt", "event_sequence", "terminal_reason", "last_message_id", "context_json", "retry_json", "created_at", "updated_at", "started_at", "completed_at", "cancellation_requested_at", "provenance_json", "trigger", "interaction_kind", "teammate_context_id", "computer_id", "resolved_configuration_json" FROM "__resource_stage_conversation_run" EXCEPT SELECT "id", "conversation_id", "project_id", "project_task_id", "stage_id", "initiator_user_id", "status", "attempt", "event_sequence", "terminal_reason", "last_message_id", "context_json", "retry_json", "created_at", "updated_at", "started_at", "completed_at", "cancellation_requested_at", "provenance_json", "trigger", "interaction_kind", "teammate_context_id", "computer_id", "resolved_configuration_json" FROM "conversation_run");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "conversation_run_command") = (SELECT count(*) FROM "__resource_stage_conversation_run_command") AND NOT EXISTS (SELECT "id", "run_id", "user_id", "command_id", "kind", "input_digest", "accepted_at" FROM "__resource_stage_conversation_run_command" EXCEPT SELECT "id", "run_id", "user_id", "command_id", "kind", "input_digest", "accepted_at" FROM "conversation_run_command");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "conversation_run_event") = (SELECT count(*) FROM "__resource_stage_conversation_run_event") AND NOT EXISTS (SELECT "id", "run_id", "sequence", "protocol_version", "attempt", "type", "occurred_at", "data" FROM "__resource_stage_conversation_run_event" EXCEPT SELECT "id", "run_id", "sequence", "protocol_version", "attempt", "type", "occurred_at", "data" FROM "conversation_run_event");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "delegation") = (SELECT count(*) FROM "__resource_stage_delegation") AND NOT EXISTS (SELECT "id", "parent_conversation_id", "child_conversation_id", "parent_run_id", "depth", "teammate_id", "goal", "wait_for", "max_credit_micros", "max_steps", "deadline", "state", "result_json", "created_at", "updated_at", "memory_bindings_json", "predecessor_delegation_id", "continuation_mode" FROM "__resource_stage_delegation" EXCEPT SELECT "id", "parent_conversation_id", "child_conversation_id", "parent_run_id", "depth", "teammate_id", "goal", "wait_for", "max_credit_micros", "max_steps", "deadline", "state", "result_json", "created_at", "updated_at", "memory_bindings_json", "predecessor_delegation_id", "continuation_mode" FROM "delegation");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "delivery") = (SELECT count(*) FROM "__resource_stage_delivery") AND NOT EXISTS (SELECT "id", "device_id", "status", "error_code", "created_at", "updated_at", "user_id", "kind", "scope_id", "operation_id", "payload_digest", "payload_json", "state", "execution_token", "execution_lease_expires_at", "sent_at", "dedupe_key", "registration_id", "task_id", "task_version", "category", "attempts", "provider_message_id", "failure_code", "next_attempt_at", "delivery_type" FROM "__resource_stage_delivery" EXCEPT SELECT "id", "device_id", "status", "error_code", "created_at", "updated_at", "user_id", "kind", "scope_id", "operation_id", "payload_digest", "payload_json", "state", "execution_token", "execution_lease_expires_at", "sent_at", "dedupe_key", "registration_id", "task_id", "task_version", "category", "attempts", "provider_message_id", "failure_code", "next_attempt_at", "delivery_type" FROM "delivery");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "document_comment") = (SELECT count(*) FROM "__resource_stage_document_comment") AND NOT EXISTS (SELECT "id", "output_id", "parent_id", "anchor_json", "source_revision", "body", "author_user_id", "resolved", "revision", "mentioned_teammate_id", "task_id", "created_at", "updated_at" FROM "__resource_stage_document_comment" EXCEPT SELECT "id", "output_id", "parent_id", "anchor_json", "source_revision", "body", "author_user_id", "resolved", "revision", "mentioned_teammate_id", "task_id", "created_at", "updated_at" FROM "document_comment");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "goal") = (SELECT count(*) FROM "__resource_stage_goal") AND NOT EXISTS (SELECT "id", "conversation_id", "sandbox_run_id", "user_id", "objective", "status", "source", "iteration_count", "stall_streak", "tokens_spent", "progress", "evidence", "stopped_reason", "created_from_message_id", "created_at", "updated_at", "completed_at", "last_continued_at" FROM "__resource_stage_goal" EXCEPT SELECT "id", "conversation_id", "sandbox_run_id", "user_id", "objective", "status", "source", "iteration_count", "stall_streak", "tokens_spent", "progress", "evidence", "stopped_reason", "created_from_message_id", "created_at", "updated_at", "completed_at", "last_continued_at" FROM "goal");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "memory_reflection") = (SELECT count(*) FROM "__resource_stage_memory_reflection") AND NOT EXISTS (SELECT "record_kind", "id", "context_id", "conversation_id", "through_message_id", "revision", "status", "evidence_json", "created_at", "updated_at" FROM "__resource_stage_memory_reflection" EXCEPT SELECT "record_kind", "id", "context_id", "conversation_id", "through_message_id", "revision", "status", "evidence_json", "created_at", "updated_at" FROM "memory_reflection");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "message") = (SELECT count(*) FROM "__resource_stage_message") AND NOT EXISTS (SELECT "id", "conversation_id", "parent_message_id", "is_archived", "role", "content", "parts", "name", "tool_calls", "citations", "model", "status", "timestamp", "platform", "mode", "log_id", "data", "usage", "tool_call_id", "tool_call_arguments", "app", "created_at", "updated_at", "run_id", "provenance_json" FROM "__resource_stage_message" EXCEPT SELECT "id", "conversation_id", "parent_message_id", "is_archived", "role", "content", "parts", "name", "tool_calls", "citations", "model", "status", "timestamp", "platform", "mode", "log_id", "data", "usage", "tool_call_id", "tool_call_arguments", "app", "created_at", "updated_at", "run_id", "provenance_json" FROM "message");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "project_task") = (SELECT count(*) FROM "__resource_stage_project_task") AND NOT EXISTS (SELECT "id", "project_id", "workspace_id", "objective", "acceptance_criteria", "expected_output", "context", "constraints", "depends_on_task_ids", "require_approval_for", "status", "source", "blocked_reason", "blocked_detail", "stage_id", "runner", "created_by_user_id", "assignee_user_id", "runner_identity_user_id", "conversation_id", "goal_id", "dispatch_task_id", "completions", "position", "token_budget", "tokens_spent", "created_at", "updated_at", "started_at", "completed_at", "flow_snapshot", "run_id", "attention_version", "origin_conversation_id", "execution_profile" FROM "__resource_stage_project_task" EXCEPT SELECT "id", "project_id", "workspace_id", "objective", "acceptance_criteria", "expected_output", "context", "constraints", "depends_on_task_ids", "require_approval_for", "status", "source", "blocked_reason", "blocked_detail", "stage_id", "runner", "created_by_user_id", "assignee_user_id", "runner_identity_user_id", "conversation_id", "goal_id", "dispatch_task_id", "completions", "position", "token_budget", "tokens_spent", "created_at", "updated_at", "started_at", "completed_at", "flow_snapshot", "run_id", "attention_version", "origin_conversation_id", "execution_profile" FROM "project_task");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "project_task_integration") = (SELECT count(*) FROM "__resource_stage_project_task_integration") AND NOT EXISTS (SELECT "id", "workspace_id", "project_id", "task_id", "source_id", "owner_user_id", "provider", "account_id", "external_id", "created_at", "target", "policy_id", "policy_revision", "publication_status", "publication_body", "published_url", "kind" FROM "__resource_stage_project_task_integration" EXCEPT SELECT "id", "workspace_id", "project_id", "task_id", "source_id", "owner_user_id", "provider", "account_id", "external_id", "created_at", "target", "policy_id", "policy_revision", "publication_status", "publication_body", "published_url", "kind" FROM "project_task_integration");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "resource_grant") = (SELECT count(*) FROM "__resource_stage_resource_grant") AND NOT EXISTS (SELECT "kind", "id", "conversation_id", "delegation_id", "granted_by", "output_id", "token_hash", "permission", "created_by_user_id", "context_id", "connection_id", "allowed_operations", "revision", "expires_at", "revoked_at", "created_at", "updated_at", "workspace_id", "user_id", "role", "email", "status", "accepted_by", "accepted_at" FROM "__resource_stage_resource_grant" EXCEPT SELECT "kind", "id", "conversation_id", "delegation_id", "granted_by", "output_id", "token_hash", "permission", "created_by_user_id", "context_id", "connection_id", "allowed_operations", "revision", "expires_at", "revoked_at", "created_at", "updated_at", "workspace_id", "user_id", "role", "email", "status", "accepted_by", "accepted_at" FROM "resource_grant");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "resource_link") = (SELECT count(*) FROM "__resource_stage_resource_link") AND NOT EXISTS (SELECT "kind", "output_id", "collection_id", "source_id", "from_version_id", "to_version_id", "relation", "created_at" FROM "__resource_stage_resource_link" EXCEPT SELECT "kind", "output_id", "collection_id", "source_id", "from_version_id", "to_version_id", "relation", "created_at" FROM "resource_link");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "resource_revision") = (SELECT count(*) FROM "__resource_stage_resource_revision") AND NOT EXISTS (SELECT "id", "document_id", "revision", "text_content", "change_note", "created_by", "created_at", "operation_id", "skill_id", "description", "digest", "storage_key", "size", "source_skill_id", "source_revision_id", "output_id", "title", "status", "sensitivity", "content", "created_by_user_id", "provenance_json", "operation", "restored_from_revision", "resource_type" FROM "__resource_stage_resource_revision" EXCEPT SELECT "id", "document_id", "revision", "text_content", "change_note", "created_by", "created_at", "operation_id", "skill_id", "description", "digest", "storage_key", "size", "source_skill_id", "source_revision_id", "output_id", "title", "status", "sensitivity", "content", "created_by_user_id", "provenance_json", "operation", "restored_from_revision", "resource_type" FROM "resource_revision");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "teammate_computer") = (SELECT count(*) FROM "__resource_stage_teammate_computer") AND NOT EXISTS (SELECT "id", "context_id", "provider", "provider_handle", "checkpoint_reference", "status", "lease_kind", "lease_owner_id", "lease_expires_at", "lease_fence", "last_error", "created_at", "updated_at" FROM "__resource_stage_teammate_computer" EXCEPT SELECT "id", "context_id", "provider", "provider_handle", "checkpoint_reference", "status", "lease_kind", "lease_owner_id", "lease_expires_at", "lease_fence", "last_error", "created_at", "updated_at" FROM "teammate_computer");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "teammate_context") = (SELECT count(*) FROM "__resource_stage_teammate_context") AND NOT EXISTS (SELECT "id", "teammate_id", "actor_user_id", "scope_type", "scope_id", "home_conversation_id", "memory_document_id", "status", "created_at", "updated_at" FROM "__resource_stage_teammate_context" EXCEPT SELECT "id", "teammate_id", "actor_user_id", "scope_type", "scope_id", "home_conversation_id", "memory_document_id", "status", "created_at", "updated_at" FROM "teammate_context");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "training_examples") = (SELECT count(*) FROM "__resource_stage_training_examples") AND NOT EXISTS (SELECT "id", "user_id", "conversation_id", "source", "app_name", "user_prompt", "assistant_response", "system_prompt", "model_used", "feedback_rating", "feedback_comment", "metadata", "exported", "exported_at", "quality_score", "include_in_training", "task_category", "difficulty_level", "language_code", "user_prompt_tokens", "assistant_response_tokens", "response_time_ms", "conversation_turn", "conversation_context", "user_satisfaction_signals", "created_at", "updated_at" FROM "__resource_stage_training_examples" EXCEPT SELECT "id", "user_id", "conversation_id", "source", "app_name", "user_prompt", "assistant_response", "system_prompt", "model_used", "feedback_rating", "feedback_comment", "metadata", "exported", "exported_at", "quality_score", "include_in_training", "task_category", "difficulty_level", "language_code", "user_prompt_tokens", "assistant_response_tokens", "response_time_ms", "conversation_turn", "conversation_context", "user_satisfaction_signals", "created_at", "updated_at" FROM "training_examples");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "usage_event") = (SELECT count(*) FROM "__resource_stage_usage_event") AND NOT EXISTS (SELECT "id", "idempotency_key", "user_id", "workspace_id", "project_id", "conversation_id", "message_id", "activity_id", "completion_id", "occurred_at", "period", "source", "vendor", "resource", "unit", "quantity", "rate_version", "unit_cost_micros", "cost_micros", "credit_micros", "billable", "byok", "estimated", "raw", "created_at", "run_id", "run_attempt", "vendor_units", "reason", "site" FROM "__resource_stage_usage_event" EXCEPT SELECT "id", "idempotency_key", "user_id", "workspace_id", "project_id", "conversation_id", "message_id", "activity_id", "completion_id", "occurred_at", "period", "source", "vendor", "resource", "unit", "quantity", "rate_version", "unit_cost_micros", "cost_micros", "credit_micros", "billable", "byok", "estimated", "raw", "created_at", "run_id", "run_attempt", "vendor_units", "reason", "site" FROM "usage_event");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM "user_resource_state") = (SELECT count(*) FROM "__resource_stage_user_resource_state") AND NOT EXISTS (SELECT "id", "user_id", "saved_conversation_id", "message_id", "note", "saved_at", "conversation_id", "is_pinned", "is_unread", "snoozed_until", "snoozed_next_response_at", "revision", "updated_at", "task_id", "task_version", "read_at", "dismissed_at", "resource_type", "teammate_id", "publication_id", "feedback_conversation_id", "rating", "verdict", "created_at" FROM "__resource_stage_user_resource_state" EXCEPT SELECT "id", "user_id", "saved_conversation_id", "message_id", "note", "saved_at", "conversation_id", "is_pinned", "is_unread", "snoozed_until", "snoozed_next_response_at", "revision", "updated_at", "task_id", "task_version", "read_at", "dismissed_at", "resource_type", "teammate_id", "publication_id", "feedback_conversation_id", "rating", "verdict", "created_at" FROM "user_resource_state");
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM resource WHERE resource_type = 'source') = (SELECT count(*) FROM "__resource_stage_source") AND NOT EXISTS (SELECT "id", "created_by_user_id", "project_id", "conversation_id", "connection_id", "kind", "title", "status", "content", "provider", "external_uri", "vector_id", "search_revision", "metadata", "storage_key", "mime_type", "filename", "byte_size", "created_at", "updated_at" FROM "__resource_stage_source" EXCEPT SELECT "id", "created_by_user_id", "project_id", "conversation_id", "connection_id", "kind", "title", "status", "content", "provider", "external_uri", "vector_id", "search_revision", "metadata", "storage_key", "mime_type", "filename", "byte_size", "created_at", "updated_at" FROM resource WHERE resource_type = 'source');
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM resource WHERE resource_type = 'output') = (SELECT count(*) FROM "__resource_stage_output") AND NOT EXISTS (SELECT "id", "created_by_user_id", "project_id", "conversation_id", "parent_output_id", "capability_id", "group_id", "kind", "title", "status", "sensitivity", "content", "storage_key", "mime_type", "filename", "byte_size", "revision", "provenance_json", "revision_created_by_user_id", "revision_created_at", "revision_operation", "restored_from_revision", "created_at", "updated_at" FROM "__resource_stage_output" EXCEPT SELECT "id", "created_by_user_id", "project_id", "conversation_id", "parent_output_id", "capability_id", "group_id", "kind", "title", "status", "sensitivity", "content", "storage_key", "mime_type", "filename", "byte_size", "revision", "provenance_json", "revision_created_by_user_id", "revision_created_at", "revision_operation", "restored_from_revision", "created_at", "updated_at" FROM resource WHERE resource_type = 'output');
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM resource WHERE resource_type = 'memory') = (SELECT count(*) FROM "__resource_stage_memory_document") AND NOT EXISTS (SELECT "id", "scope_type", "scope_id", "kind", "name", "content", "revision", "created_by", "deleted_at", "created_at", "updated_at" FROM "__resource_stage_memory_document" EXCEPT SELECT "id", "scope_type", "scope_id", "kind", "title", "content", "revision", "created_by_user_id", "deleted_at", "created_at", "updated_at" FROM resource WHERE resource_type = 'memory');
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM resource WHERE resource_type = 'skill') = (SELECT count(*) FROM "__resource_stage_authored_skill") AND NOT EXISTS (SELECT "id", "scope_type", "scope_id", "name", "created_by", "draft_revision_id", "stable_revision_id", "state_version", "archived_at", "created_at", "updated_at" FROM "__resource_stage_authored_skill" EXCEPT SELECT "id", "scope_type", "scope_id", "title", "created_by_user_id", "draft_revision_id", "stable_revision_id", "state_version", "archived_at", "created_at", "updated_at" FROM resource WHERE resource_type = 'skill');
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT (SELECT count(*) FROM resource WHERE resource_type = 'synthesis') = (SELECT count(*) FROM "__resource_stage_memory_syntheses") AND NOT EXISTS (SELECT "id", "user_id", "synthesis_text", "synthesis_version", "memory_ids", "memory_count", "tokens_used", "namespace", "is_active", "superseded_by", "created_at", "updated_at" FROM "__resource_stage_memory_syntheses" EXCEPT SELECT "id", "created_by_user_id", "content", "revision", "memory_ids", "memory_count", "tokens_used", "namespace", "is_active", "superseded_by", "created_at", "updated_at" FROM resource WHERE resource_type = 'synthesis');
--> statement-breakpoint
DROP TABLE "__resource_stage_activity_record";
--> statement-breakpoint
DROP TABLE "__resource_stage_authored_skill";
--> statement-breakpoint
DROP TABLE "__resource_stage_browser_session";
--> statement-breakpoint
DROP TABLE "__resource_stage_composio_connector_session";
--> statement-breakpoint
DROP TABLE "__resource_stage_conversation";
--> statement-breakpoint
DROP TABLE "__resource_stage_conversation_run";
--> statement-breakpoint
DROP TABLE "__resource_stage_conversation_run_command";
--> statement-breakpoint
DROP TABLE "__resource_stage_conversation_run_event";
--> statement-breakpoint
DROP TABLE "__resource_stage_delegation";
--> statement-breakpoint
DROP TABLE "__resource_stage_delivery";
--> statement-breakpoint
DROP TABLE "__resource_stage_document_comment";
--> statement-breakpoint
DROP TABLE "__resource_stage_goal";
--> statement-breakpoint
DROP TABLE "__resource_stage_memory_document";
--> statement-breakpoint
DROP TABLE "__resource_stage_memory_reflection";
--> statement-breakpoint
DROP TABLE "__resource_stage_memory_syntheses";
--> statement-breakpoint
DROP TABLE "__resource_stage_message";
--> statement-breakpoint
DROP TABLE "__resource_stage_output";
--> statement-breakpoint
DROP TABLE "__resource_stage_project_task";
--> statement-breakpoint
DROP TABLE "__resource_stage_project_task_integration";
--> statement-breakpoint
DROP TABLE "__resource_stage_resource_grant";
--> statement-breakpoint
DROP TABLE "__resource_stage_resource_link";
--> statement-breakpoint
DROP TABLE "__resource_stage_resource_revision";
--> statement-breakpoint
DROP TABLE "__resource_stage_source";
--> statement-breakpoint
DROP TABLE "__resource_stage_teammate_computer";
--> statement-breakpoint
DROP TABLE "__resource_stage_teammate_context";
--> statement-breakpoint
DROP TABLE "__resource_stage_training_examples";
--> statement-breakpoint
DROP TABLE "__resource_stage_usage_event";
--> statement-breakpoint
DROP TABLE "__resource_stage_user_resource_state";
--> statement-breakpoint
INSERT INTO __resource_copy_check SELECT NOT EXISTS (SELECT 1 FROM pragma_foreign_key_check);
--> statement-breakpoint
DROP TABLE __resource_copy_check;
--> statement-breakpoint
CREATE TRIGGER source_connection_deleted BEFORE DELETE ON provider_connection BEGIN
  UPDATE resource SET status = 'archived' WHERE resource_type = 'source' AND connection_id = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER source_knowledge_sync_deleted BEFORE DELETE ON source_knowledge_sync BEGIN
  UPDATE resource SET status = 'archived' WHERE resource_type = 'source' AND json_extract(metadata, '$.syncId') = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER document_comment_revision_guard
BEFORE INSERT ON document_comment
WHEN NOT EXISTS (
  SELECT 1 FROM resource output
  WHERE resource_type = 'output' AND id = NEW.output_id AND kind = 'document' AND revision = NEW.source_revision
)
BEGIN
  SELECT RAISE(ABORT, 'document_revision_conflict');
END;
--> statement-breakpoint
CREATE TRIGGER document_comment_parent_guard
BEFORE INSERT ON document_comment
WHEN NEW.parent_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM document_comment
  WHERE id = NEW.parent_id AND output_id = NEW.output_id AND parent_id IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'document_thread_conflict');
END;
--> statement-breakpoint
CREATE TRIGGER source_task_snapshot_immutable
BEFORE UPDATE OF content, metadata, title, external_uri, provider, scope_type, scope_id ON resource
WHEN OLD.resource_type = 'source' AND (json_extract(OLD.metadata, '$.immutableSnapshot') = 1
  OR EXISTS (SELECT 1 FROM project_task_integration WHERE source_id = OLD.id))
BEGIN
  SELECT RAISE(ABORT, 'Task snapshots are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER search_chunk_insert AFTER INSERT ON search_chunk WHEN new.document_type = 'source' BEGIN
  INSERT INTO search_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
END;
--> statement-breakpoint
CREATE TRIGGER search_chunk_delete AFTER DELETE ON search_chunk WHEN old.document_type = 'source' BEGIN
  INSERT INTO search_fts(search_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
END;
--> statement-breakpoint
CREATE TRIGGER search_chunk_update AFTER UPDATE OF title, content ON search_chunk WHEN new.document_type = 'source' BEGIN
  INSERT INTO search_fts(search_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
  INSERT INTO search_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
END;
--> statement-breakpoint
CREATE TRIGGER source_search_revision_update
AFTER UPDATE OF content, title, status, scope_type, scope_id, created_by_user_id, external_uri, kind, connection_id ON resource
WHEN old.resource_type = 'source' AND (old.content IS NOT new.content OR old.title IS NOT new.title OR old.status IS NOT new.status
  OR old.project_id IS NOT new.project_id OR old.created_by_user_id IS NOT new.created_by_user_id
  OR old.external_uri IS NOT new.external_uri OR old.kind IS NOT new.kind OR old.connection_id IS NOT new.connection_id)
BEGIN
  UPDATE resource SET search_revision = old.search_revision + 1 WHERE resource_type = 'source' AND id = new.id;
  UPDATE search_document SET status = 'stale' WHERE document_type = 'source' AND source_id = new.id;
END;
--> statement-breakpoint
CREATE TRIGGER source_search_revision_delete AFTER DELETE ON resource WHEN old.resource_type = 'source' BEGIN
  UPDATE search_document SET status = 'stale' WHERE document_type = 'source' AND source_id = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER document_comment_authority_guard
BEFORE INSERT ON document_comment
WHEN NOT EXISTS (
  SELECT 1 FROM resource output WHERE resource_type = 'output' AND id = NEW.output_id
    AND ((project_id IS NULL AND created_by_user_id = NEW.author_user_id)
      OR EXISTS (SELECT 1 FROM project JOIN resource_grant member ON member.kind = 'membership' AND member.workspace_id = project.workspace_id
        WHERE project.id = output.project_id AND member.user_id = NEW.author_user_id))
)
BEGIN
  SELECT RAISE(ABORT, 'document_access_revoked');
END;
--> statement-breakpoint
PRAGMA defer_foreign_keys = OFF;
