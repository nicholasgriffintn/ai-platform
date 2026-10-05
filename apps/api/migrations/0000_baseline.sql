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
CREATE INDEX `activity_record_created_by_user_id_idx` ON `activity_record` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `activity_record_project_id_idx` ON `activity_record` (`project_id`);--> statement-breakpoint
CREATE INDEX `activity_record_conversation_id_idx` ON `activity_record` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `activity_record_group_id_idx` ON `activity_record` (`group_id`);--> statement-breakpoint
CREATE INDEX `activity_record_operational_idx` ON `activity_record` (`capability_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `anonymous_user` (
	`id` text PRIMARY KEY NOT NULL,
	`ip_address` text NOT NULL,
	`user_agent` text,
	`credit_period` text,
	`spent_credit_micros` integer DEFAULT 0 NOT NULL,
	`reserved_credit_micros` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	`last_active_at` text,
	`captcha_verified` integer DEFAULT false
);
--> statement-breakpoint
CREATE TABLE `approval` (
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`workspace_id` text,
	`project_id` text,
	`version_id` text,
	`route_id` text,
	`route_kind` text DEFAULT 'route' NOT NULL,
	`state` text NOT NULL,
	`subject_type` text,
	`subject_id` text,
	`data` text,
	`requested_by` integer,
	`decided_by` integer,
	`decided_at` text,
	`expires_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`user_id` integer,
	`run_id` text,
	`run_attempt` integer DEFAULT 1,
	`completion_id` text,
	`provider` text,
	`operation` text,
	`connected_account_id` text,
	`channel` text,
	`argument_digest` text,
	`arguments_json` text,
	`authority_revision` integer DEFAULT 0,
	`recipe_id` text,
	`installation_id` text,
	`teammate_context_id` text,
	`resolved_at` text,
	`consumed_at` text,
	`execution_state` text,
	`execution_token` text,
	`execution_lease_expires_at` text,
	`execution_result_json` text,
	`model_project_id` text GENERATED ALWAYS AS (CASE WHEN kind IN ('decision','spend') THEN project_id END) VIRTUAL,
	PRIMARY KEY(`kind`, `id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`decided_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`model_project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`route_kind`,`route_id`) REFERENCES `model_configuration`(`kind`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "approval_route_kind_check" CHECK("approval"."route_kind" = 'route'),
	CONSTRAINT "approval_shape_check" CHECK(("approval"."kind" = 'decision' AND "approval"."workspace_id" IS NOT NULL AND "approval"."data" IS NOT NULL AND "approval"."version_id" IS NOT NULL) OR ("approval"."kind" = 'spend' AND "approval"."workspace_id" IS NOT NULL AND "approval"."data" IS NOT NULL AND "approval"."subject_type" IS NOT NULL AND "approval"."subject_type" IN ('training_run', 'deployment')) OR ("approval"."kind" = 'connector' AND "approval"."user_id" IS NOT NULL AND "approval"."run_id" IS NOT NULL AND "approval"."run_attempt" IS NOT NULL AND "approval"."completion_id" IS NOT NULL AND "approval"."provider" IS NOT NULL AND "approval"."operation" IS NOT NULL AND "approval"."connected_account_id" IS NOT NULL AND "approval"."channel" IS NOT NULL AND "approval"."argument_digest" IS NOT NULL AND "approval"."arguments_json" IS NOT NULL AND "approval"."authority_revision" IS NOT NULL AND "approval"."expires_at" IS NOT NULL AND "approval"."state" IN ('pending','approved','rejected','consumed') AND "approval"."workspace_id" IS NULL AND "approval"."version_id" IS NULL AND "approval"."route_id" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `approval_owner_state_idx` ON `approval` (`kind`,`user_id`,`state`);--> statement-breakpoint
CREATE INDEX `approval_run_idx` ON `approval` (`kind`,`run_id`);--> statement-breakpoint
CREATE INDEX `approval_workspace_idx` ON `approval` (`kind`,`workspace_id`,`state`,`created_at`);--> statement-breakpoint
CREATE INDEX `approval_version_idx` ON `approval` (`kind`,`version_id`,`route_id`);--> statement-breakpoint
CREATE INDEX `approval_expiration_idx` ON `approval` (`kind`,`state`,`expires_at`);--> statement-breakpoint
CREATE TABLE `artificial_analysis_models` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text,
	`creator_id` text,
	`creator_name` text,
	`creator_slug` text,
	`evaluations` text NOT NULL,
	`pricing` text NOT NULL,
	`intelligence_index` real,
	`coding_index` real,
	`agentic_index` real,
	`intelligence_index_version` real,
	`price_1m_blended_3_to_1` real,
	`price_1m_input_tokens` real,
	`price_1m_output_tokens` real,
	`median_output_tokens_per_second` real,
	`median_time_to_first_token_seconds` real,
	`median_time_to_first_answer_token_seconds` real,
	`median_end_to_end_response_time_seconds` real,
	`derived_strengths` text,
	`derived_scores` text,
	`source` text DEFAULT 'artificial_analysis' NOT NULL,
	`source_url` text DEFAULT 'https://artificialanalysis.ai/' NOT NULL,
	`ingested_at` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE INDEX `artificial_analysis_models_slug_idx` ON `artificial_analysis_models` (`slug`);--> statement-breakpoint
CREATE INDEX `artificial_analysis_models_creator_slug_idx` ON `artificial_analysis_models` (`creator_slug`);--> statement-breakpoint
CREATE INDEX `artificial_analysis_models_ingested_at_idx` ON `artificial_analysis_models` (`ingested_at`);--> statement-breakpoint
CREATE TABLE `authentication_token` (
	`purpose` text NOT NULL,
	`token_hash` text NOT NULL,
	`provider` text,
	`kind` text,
	`payload` text,
	`oauth_data` text,
	`session_id` text,
	`binding_id` text,
	`user_id` integer,
	`consumed_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`expires_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`purpose`, `token_hash`),
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`binding_id`) REFERENCES `channel_binding`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "authentication_token_purpose_check" CHECK(
      ("authentication_token"."purpose" = 'oauth_state' AND "authentication_token"."provider" IS NOT NULL AND "authentication_token"."oauth_data" IS NOT NULL AND "authentication_token"."kind" IS NULL AND "authentication_token"."payload" IS NULL AND "authentication_token"."session_id" IS NULL AND "authentication_token"."binding_id" IS NULL AND "authentication_token"."user_id" IS NULL AND "authentication_token"."consumed_at" IS NULL)
      OR ("authentication_token"."purpose" = 'challenge' AND "authentication_token"."provider" IS NOT NULL AND "authentication_token"."kind" IS NOT NULL AND "authentication_token"."payload" IS NOT NULL AND "authentication_token"."oauth_data" IS NULL AND "authentication_token"."session_id" IS NULL AND "authentication_token"."binding_id" IS NULL AND "authentication_token"."user_id" IS NULL AND "authentication_token"."consumed_at" IS NULL)
      OR ("authentication_token"."purpose" = 'native_exchange' AND "authentication_token"."session_id" IS NOT NULL AND "authentication_token"."user_id" IS NOT NULL AND "authentication_token"."consumed_at" IS NOT NULL AND "authentication_token"."binding_id" IS NULL AND "authentication_token"."provider" IS NULL AND "authentication_token"."kind" IS NULL AND "authentication_token"."payload" IS NULL AND "authentication_token"."oauth_data" IS NULL)
      OR ("authentication_token"."purpose" = 'channel_pairing' AND "authentication_token"."binding_id" IS NOT NULL AND "authentication_token"."user_id" IS NOT NULL AND "authentication_token"."session_id" IS NULL AND "authentication_token"."provider" IS NULL AND "authentication_token"."kind" IS NULL AND "authentication_token"."payload" IS NULL AND "authentication_token"."oauth_data" IS NULL AND "authentication_token"."consumed_at" IS NULL)
    )
);
--> statement-breakpoint
CREATE INDEX `authentication_token_expires_at_idx` ON `authentication_token` (`purpose`,`expires_at`);--> statement-breakpoint
CREATE INDEX `authentication_token_session_idx` ON `authentication_token` (`session_id`);--> statement-breakpoint
CREATE INDEX `authentication_token_user_idx` ON `authentication_token` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `authentication_token_pairing_owner_idx` ON `authentication_token` (`binding_id`,`user_id`) WHERE "authentication_token"."purpose" = 'channel_pairing';--> statement-breakpoint
CREATE TABLE `channel_binding` (
	`id` text PRIMARY KEY NOT NULL,
	`channel` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text NOT NULL,
	`external_id` text NOT NULL,
	`label` text,
	`teammate_id` text,
	`interaction_mode` text DEFAULT 'automated' NOT NULL,
	`created_by` integer NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`teammate_id`) REFERENCES `teammates`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channel_binding_channel_external_idx` ON `channel_binding` (`channel`,`external_id`);--> statement-breakpoint
CREATE INDEX `channel_binding_scope_idx` ON `channel_binding` (`scope_type`,`scope_id`);--> statement-breakpoint
CREATE TABLE `channel_sender` (
	`id` text PRIMARY KEY NOT NULL,
	`binding_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`revoked_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`binding_id`) REFERENCES `channel_binding`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channel_sender_identity_idx` ON `channel_sender` (`binding_id`,`sender_id`);--> statement-breakpoint
CREATE INDEX `channel_sender_user_idx` ON `channel_sender` (`user_id`);--> statement-breakpoint
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
	`model_id` text,
	`model_tier` text,
	`permission_mode` text DEFAULT 'auto_accept_edits' NOT NULL,
	`group_id` text,
	`group_assigned_by_user_id` integer,
	`group_assigned_at` text,
	`brief_document_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `resource_collection`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`group_assigned_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`brief_document_id`) REFERENCES `resource`(`memory_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_share_id_unique` ON `conversation` (`share_id`);--> statement-breakpoint
CREATE INDEX `conversation_group_idx` ON `conversation` (`group_id`);--> statement-breakpoint
CREATE INDEX `conversation_title_idx` ON `conversation` (`title`);--> statement-breakpoint
CREATE INDEX `conversation_archived_idx` ON `conversation` (`is_archived`);--> statement-breakpoint
CREATE INDEX `conversation_public_idx` ON `conversation` (`is_public`);--> statement-breakpoint
CREATE INDEX `conversation_share_id_idx` ON `conversation` (`share_id`);--> statement-breakpoint
CREATE INDEX `conversation_user_id_idx` ON `conversation` (`user_id`);--> statement-breakpoint
CREATE INDEX `conversation_type_idx` ON `conversation` (`type`);--> statement-breakpoint
CREATE INDEX `conversation_parent_conversation_id_idx` ON `conversation` (`parent_conversation_id`);--> statement-breakpoint
CREATE INDEX `conversation_parent_message_id_idx` ON `conversation` (`parent_message_id`);--> statement-breakpoint
CREATE INDEX `conversation_project_id_idx` ON `conversation` (`project_id`);--> statement-breakpoint
CREATE INDEX `conversation_brief_document_idx` ON `conversation` (`brief_document_id`);--> statement-breakpoint
CREATE INDEX `conversation_user_project_archived_updated_idx` ON `conversation` (`user_id`,`project_id`,`is_archived`,`updated_at`);--> statement-breakpoint
CREATE TABLE `conversation_run` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`project_id` text,
	`project_task_id` text,
	`stage_id` text,
	`initiator_user_id` integer NOT NULL,
	`teammate_context_id` text,
	`computer_id` text,
	`trigger` text DEFAULT 'user' NOT NULL,
	`status` text DEFAULT 'accepted' NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`event_sequence` integer DEFAULT 0 NOT NULL,
	`terminal_reason` text,
	`interaction_kind` text,
	`last_message_id` text,
	`context_json` text,
	`retry_json` text,
	`provenance_json` text,
	`resolved_configuration_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`started_at` text,
	`completed_at` text,
	`cancellation_requested_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`initiator_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teammate_context_id`) REFERENCES `teammate_context`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`computer_id`) REFERENCES `teammate_context`(`computer_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `conversation_run_conversation_updated_idx` ON `conversation_run` (`conversation_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `conversation_run_project_updated_idx` ON `conversation_run` (`project_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `conversation_run_project_task_idx` ON `conversation_run` (`project_task_id`);--> statement-breakpoint
CREATE INDEX `conversation_run_initiator_idx` ON `conversation_run` (`initiator_user_id`);--> statement-breakpoint
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
CREATE UNIQUE INDEX `conversation_run_command_user_command_idx` ON `conversation_run_command` (`user_id`,`command_id`);--> statement-breakpoint
CREATE INDEX `conversation_run_command_run_accepted_idx` ON `conversation_run_command` (`run_id`,`accepted_at`);--> statement-breakpoint
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
CREATE UNIQUE INDEX `conversation_run_event_run_sequence_idx` ON `conversation_run_event` (`run_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `conversation_run_event_run_occurred_idx` ON `conversation_run_event` (`run_id`,`occurred_at`);--> statement-breakpoint
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
	`memory_bindings_json` text DEFAULT '[]' NOT NULL,
	`predecessor_delegation_id` text,
	`continuation_mode` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`parent_conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_run_id`) REFERENCES `conversation_run`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `delegation_parent_conversation_idx` ON `delegation` (`parent_conversation_id`);--> statement-breakpoint
CREATE INDEX `delegation_child_conversation_idx` ON `delegation` (`child_conversation_id`);--> statement-breakpoint
CREATE TABLE `delivery` (
	`id` text NOT NULL,
	`device_id` text,
	`trigger_id` text,
	`event_id` text,
	`decision_receipt` text,
	`queued_task_id` text,
	`status` text,
	`error_code` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	`user_id` integer,
	`kind` text,
	`scope_id` text,
	`operation_id` text,
	`payload_digest` text,
	`payload_json` text,
	`state` text DEFAULT 'prepared',
	`execution_token` text,
	`execution_lease_expires_at` text,
	`sent_at` text,
	`dedupe_key` text,
	`registration_id` text,
	`task_id` text,
	`task_version` integer,
	`category` text,
	`attempts` integer DEFAULT 0,
	`provider_message_id` text,
	`failure_code` text,
	`next_attempt_at` text,
	`endpoint_platform` text GENERATED ALWAYS AS (CASE WHEN delivery_type = 'mobile' THEN 'ios' WHEN delivery_type = 'task' THEN 'web' END) VIRTUAL,
	`endpoint_id` text GENERATED ALWAYS AS (COALESCE(device_id, registration_id)) VIRTUAL,
	`delivery_type` text NOT NULL,
	PRIMARY KEY(`delivery_type`, `id`),
	FOREIGN KEY (`trigger_id`) REFERENCES `event_subscription`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`endpoint_platform`,`endpoint_id`) REFERENCES `notification_endpoint`(`platform`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "delivery_required_fields" CHECK((delivery_type = 'mobile' AND id IS NOT NULL AND device_id IS NOT NULL AND status IS NOT NULL AND created_at IS NOT NULL) OR (delivery_type = 'task' AND id IS NOT NULL AND dedupe_key IS NOT NULL AND registration_id IS NOT NULL AND user_id IS NOT NULL AND task_id IS NOT NULL AND task_version IS NOT NULL AND category IS NOT NULL AND status IS NOT NULL AND attempts IS NOT NULL AND created_at IS NOT NULL) OR (delivery_type = 'outbound' AND id IS NOT NULL AND user_id IS NOT NULL AND kind IS NOT NULL AND scope_id IS NOT NULL AND operation_id IS NOT NULL AND payload_digest IS NOT NULL AND payload_json IS NOT NULL AND state IS NOT NULL AND created_at IS NOT NULL AND updated_at IS NOT NULL) OR (delivery_type = 'recipe_event' AND trigger_id IS NOT NULL AND event_id IS NOT NULL AND state IS NOT NULL AND created_at IS NOT NULL)),
	CONSTRAINT "delivery_shape_0" CHECK((delivery_type = 'mobile' AND device_id IS NOT NULL AND registration_id IS NULL AND operation_id IS NULL AND status IN ('sending','sent','failed')) OR (delivery_type = 'task' AND registration_id IS NOT NULL AND device_id IS NULL AND operation_id IS NULL AND user_id IS NOT NULL AND task_id IS NOT NULL AND task_version IS NOT NULL AND dedupe_key IS NOT NULL AND category IN ('decisions','failures','completions','assignments') AND status IN ('pending','delivered','failed','obsolete')) OR (delivery_type = 'outbound' AND device_id IS NULL AND registration_id IS NULL AND user_id IS NOT NULL AND kind IS NOT NULL AND scope_id IS NOT NULL AND operation_id IS NOT NULL AND payload_digest IS NOT NULL AND payload_json IS NOT NULL AND state IN ('prepared','sending','sent','indeterminate')) OR (delivery_type = 'recipe_event' AND trigger_id IS NOT NULL AND event_id IS NOT NULL AND state IN ('evaluating','skipped','queued') AND device_id IS NULL AND registration_id IS NULL AND task_id IS NULL AND operation_id IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_recipe_event_idx` ON `delivery` (`trigger_id`,`event_id`) WHERE delivery_type = 'recipe_event';--> statement-breakpoint
CREATE INDEX `delivery_recipe_lease_idx` ON `delivery` (`delivery_type`,`state`,`execution_lease_expires_at`) WHERE delivery_type = 'recipe_event';--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_dedupe_idx` ON `delivery` (`dedupe_key`) WHERE delivery_type = 'task';--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_outbound_operation_idx` ON `delivery` (`kind`,`scope_id`,`operation_id`) WHERE delivery_type = 'outbound';--> statement-breakpoint
CREATE INDEX `delivery_endpoint_idx` ON `delivery` (`endpoint_platform`,`endpoint_id`);--> statement-breakpoint
CREATE INDEX `delivery_due_idx` ON `delivery` (`delivery_type`,`status`,`next_attempt_at`) WHERE delivery_type = 'task';--> statement-breakpoint
CREATE INDEX `delivery_task_version_idx` ON `delivery` (`task_id`,`task_version`) WHERE task_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX `delivery_outbound_owner_state_idx` ON `delivery` (`delivery_type`,`user_id`,`state`) WHERE delivery_type = 'outbound';--> statement-breakpoint
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
	FOREIGN KEY (`output_id`) REFERENCES `resource`(`output_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `document_comment`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "document_comment_source_revision_check" CHECK("document_comment"."source_revision" > 0),
	CONSTRAINT "document_comment_revision_check" CHECK("document_comment"."revision" > 0)
);
--> statement-breakpoint
CREATE INDEX `document_comment_output_idx` ON `document_comment` (`output_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `event_subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`broker` text NOT NULL,
	`installation_id` text NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`project_id` text,
	`provider_id` text NOT NULL,
	`trigger_slug` text NOT NULL,
	`external_trigger_id` text NOT NULL,
	`connected_account_id` text NOT NULL,
	`external_user_id` text NOT NULL,
	`configuration` text DEFAULT '{}' NOT NULL,
	`condition` text,
	`status` text DEFAULT 'active' NOT NULL,
	`last_error` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`installation_id`) REFERENCES `template`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_subscription_external_identity_idx` ON `event_subscription` (`broker`,`external_trigger_id`);--> statement-breakpoint
CREATE INDEX `event_subscription_installation_idx` ON `event_subscription` (`installation_id`);--> statement-breakpoint
CREATE INDEX `event_subscription_owner_idx` ON `event_subscription` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `event_subscription_account_idx` ON `event_subscription` (`connected_account_id`);--> statement-breakpoint
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
CREATE INDEX `goal_conversation_id_idx` ON `goal` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `goal_sandbox_run_id_idx` ON `goal` (`sandbox_run_id`);--> statement-breakpoint
CREATE INDEX `goal_user_id_idx` ON `goal` (`user_id`);--> statement-breakpoint
CREATE INDEX `goal_status_idx` ON `goal` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `goal_active_conversation_idx` ON `goal` (`conversation_id`) WHERE "goal"."status" IN ('active','paused') AND "goal"."conversation_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `goal_active_sandbox_run_idx` ON `goal` (`sandbox_run_id`) WHERE "goal"."status" IN ('active','paused') AND "goal"."sandbox_run_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `infra_cost_daily` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`resource` text NOT NULL,
	`unit` text NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`cost_micros` integer DEFAULT 0 NOT NULL,
	`attributed_cost_micros` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'graphql' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE INDEX `infra_cost_daily_day_idx` ON `infra_cost_daily` (`day`);--> statement-breakpoint
CREATE TABLE `machine` (
	`user_id` integer NOT NULL,
	`machine_id` text NOT NULL,
	`label` text NOT NULL,
	`platform` text NOT NULL,
	`app_version` text NOT NULL,
	`runtimes` text NOT NULL,
	`capabilities` text NOT NULL,
	`last_seen_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY(`user_id`, `machine_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `machine_user_idx` ON `machine` (`user_id`,`last_seen_at`);--> statement-breakpoint
CREATE TABLE `memory_reflection` (
	`record_kind` text NOT NULL,
	`id` text NOT NULL,
	`context_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`through_message_id` text NOT NULL,
	`revision` integer,
	`status` text,
	`evidence_json` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`record_kind`, `id`),
	FOREIGN KEY (`context_id`) REFERENCES `teammate_context`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "memory_reflection_shape" CHECK(record_kind = 'checkpoint' OR (record_kind = 'result' AND revision IS NOT NULL AND status IS NOT NULL AND status IN ('applied', 'no_change') AND evidence_json IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memory_reflection_checkpoint_idx` ON `memory_reflection` (`context_id`,`conversation_id`) WHERE record_kind = 'checkpoint';--> statement-breakpoint
CREATE INDEX `memory_reflection_context_idx` ON `memory_reflection` (`context_id`);--> statement-breakpoint
CREATE INDEX `memory_reflection_conversation_idx` ON `memory_reflection` (`conversation_id`);--> statement-breakpoint
CREATE TABLE `message` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`run_id` text,
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
	`provenance_json` text,
	`tool_call_id` text,
	`tool_call_arguments` text,
	`app` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `conversation_run`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `message_conversation_id_idx` ON `message` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `message_archived_idx` ON `message` (`is_archived`);--> statement-breakpoint
CREATE INDEX `message_parent_message_id_idx` ON `message` (`parent_message_id`);--> statement-breakpoint
CREATE INDEX `message_role_idx` ON `message` (`role`);--> statement-breakpoint
CREATE INDEX `message_run_id_idx` ON `message` (`run_id`);--> statement-breakpoint
CREATE TABLE `model_asset_version` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`asset_kind` text DEFAULT 'asset' NOT NULL,
	`workspace_id` text NOT NULL,
	`revision` text NOT NULL,
	`status` text DEFAULT 'importing' NOT NULL,
	`dataset_profile` text,
	`attributes` text NOT NULL,
	`failure_reason` text,
	`created_by` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`asset_kind`,`asset_id`) REFERENCES `model_configuration`(`kind`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "model_asset_version_asset_kind_check" CHECK("model_asset_version"."asset_kind" = 'asset')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_asset_version_revision_idx` ON `model_asset_version` (`asset_id`,`revision`);--> statement-breakpoint
CREATE INDEX `model_asset_version_workspace_idx` ON `model_asset_version` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `model_configuration` (
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text,
	`scope_key` text NOT NULL,
	`name` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`encrypted_secret` text,
	`asset_type` text,
	`source` text,
	`source_ref` text,
	`version_id` text,
	`provider` text,
	`provider_model_id` text,
	`status` text,
	`route_id` text,
	`route_kind` text,
	`canary_route_id` text,
	`canary_route_kind` text,
	`data` text NOT NULL,
	`created_by` integer,
	`updated_by` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`kind`, `id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`route_kind`,`route_id`) REFERENCES `model_configuration`(`kind`,`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`canary_route_kind`,`canary_route_id`) REFERENCES `model_configuration`(`kind`,`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "model_configuration_alias_route_check" CHECK(("model_configuration"."route_id" IS NULL OR "model_configuration"."route_kind" = 'route') AND ("model_configuration"."canary_route_id" IS NULL OR "model_configuration"."canary_route_kind" = 'route')),
	CONSTRAINT "model_configuration_shape_check" CHECK(("model_configuration"."kind" IN ('policy', 'budget')) OR ("model_configuration"."kind" IN ('suite', 'grader') AND "model_configuration"."name" IS NOT NULL) OR ("model_configuration"."kind" = 'connection' AND "model_configuration"."project_id" IS NULL AND "model_configuration"."encrypted_secret" IS NOT NULL) OR ("model_configuration"."kind" = 'asset' AND "model_configuration"."asset_type" IS NOT NULL AND "model_configuration"."source" IS NOT NULL AND "model_configuration"."source_ref" IS NOT NULL AND "model_configuration"."name" IS NOT NULL AND "model_configuration"."version_id" IS NULL) OR ("model_configuration"."kind" = 'route' AND "model_configuration"."version_id" IS NOT NULL AND "model_configuration"."provider" IS NOT NULL AND "model_configuration"."provider_model_id" IS NOT NULL AND "model_configuration"."status" IS NOT NULL) OR ("model_configuration"."kind" = 'alias' AND "model_configuration"."name" IS NOT NULL AND "model_configuration"."version_id" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_configuration_scope_idx` ON `model_configuration` (`workspace_id`,`kind`,`scope_key`) WHERE "model_configuration"."kind" IN ('policy', 'budget', 'connection');--> statement-breakpoint
CREATE UNIQUE INDEX `model_configuration_asset_source_idx` ON `model_configuration` (`workspace_id`,`asset_type`,`source`,`source_ref`) WHERE "model_configuration"."kind" = 'asset';--> statement-breakpoint
CREATE UNIQUE INDEX `model_configuration_route_target_idx` ON `model_configuration` (`workspace_id`,`version_id`,`provider`,`provider_model_id`) WHERE "model_configuration"."kind" = 'route';--> statement-breakpoint
CREATE INDEX `model_configuration_route_provider_idx` ON `model_configuration` (`kind`,`provider`,`provider_model_id`,`status`);--> statement-breakpoint
CREATE INDEX `model_configuration_route_version_idx` ON `model_configuration` (`kind`,`workspace_id`,`version_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `model_configuration_alias_name_idx` ON `model_configuration` (`workspace_id`,`scope_key`,`name`) WHERE "model_configuration"."kind" = 'alias';--> statement-breakpoint
CREATE INDEX `model_configuration_alias_route_idx` ON `model_configuration` (`kind`,`route_id`);--> statement-breakpoint
CREATE INDEX `model_configuration_alias_canary_idx` ON `model_configuration` (`kind`,`canary_route_id`);--> statement-breakpoint
CREATE INDEX `model_configuration_workspace_idx` ON `model_configuration` (`workspace_id`,`kind`,`project_id`);--> statement-breakpoint
CREATE TABLE `model_operation` (
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text,
	`status` text NOT NULL,
	`name` text,
	`provider` text,
	`provider_ref` text,
	`claim_started_at` text,
	`desired_state` text,
	`version_id` text,
	`output_version_id` text,
	`subject_version_id` text,
	`suite_id` text,
	`suite_kind` text DEFAULT 'suite' NOT NULL,
	`route_id` text,
	`evaluation_route_id` text,
	`evaluation_route_kind` text DEFAULT 'route' NOT NULL,
	`trigger` text,
	`billed_until` text,
	`data` text NOT NULL,
	`failure_reason` text,
	`created_by` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`started_at` text,
	`completed_at` text,
	`last_checked_at` text,
	PRIMARY KEY(`kind`, `id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`output_version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`evaluation_route_kind`,`evaluation_route_id`) REFERENCES `model_configuration`(`kind`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`suite_kind`,`suite_id`) REFERENCES `model_configuration`(`kind`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "model_operation_evaluation_route_kind_check" CHECK("model_operation"."evaluation_route_kind" = 'route'),
	CONSTRAINT "model_operation_suite_kind_check" CHECK("model_operation"."suite_kind" = 'suite'),
	CONSTRAINT "model_operation_shape_check" CHECK(("model_operation"."kind" = 'training' AND "model_operation"."provider" IS NOT NULL) OR ("model_operation"."kind" = 'evaluation' AND "model_operation"."suite_id" IS NOT NULL AND "model_operation"."evaluation_route_id" IS NOT NULL AND "model_operation"."subject_version_id" IS NOT NULL AND "model_operation"."trigger" IS NOT NULL) OR ("model_operation"."kind" = 'deployment' AND "model_operation"."name" IS NOT NULL AND "model_operation"."version_id" IS NOT NULL AND "model_operation"."provider" IS NOT NULL AND "model_operation"."desired_state" IS NOT NULL) OR ("model_operation"."kind" = 'upload' AND "model_operation"."name" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `model_operation_workspace_idx` ON `model_operation` (`kind`,`workspace_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `model_operation_active_idx` ON `model_operation` (`kind`,`status`,`last_checked_at`);--> statement-breakpoint
CREATE INDEX `model_operation_suite_idx` ON `model_operation` (`kind`,`suite_id`,`evaluation_route_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `model_operation_route_idx` ON `model_operation` (`kind`,`evaluation_route_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `model_operation_completed_idx` ON `model_operation` (`kind`,`suite_id`,`evaluation_route_id`,`status`,`completed_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `model_operation_deployment_name_idx` ON `model_operation` (`workspace_id`,`name`) WHERE "model_operation"."kind" = 'deployment';--> statement-breakpoint
CREATE TABLE `model_record` (
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`version_id` text,
	`route_id` text,
	`configuration_id` text,
	`configuration_kind` text DEFAULT 'policy' NOT NULL,
	`alias_id` text,
	`alias_kind` text DEFAULT 'alias' NOT NULL,
	`operation_id` text,
	`operation_kind` text DEFAULT 'training' NOT NULL,
	`output_version_id` text,
	`event_kind` text,
	`ordinal` integer,
	`status` text,
	`source` text,
	`path` text,
	`workspace_id` text,
	`project_id` text,
	`subject_type` text,
	`subject_id` text,
	`provider` text,
	`usd` real,
	`period_start` text,
	`period_end` text,
	`data` text NOT NULL,
	`actor_user_id` integer,
	`created_by` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`kind`, `id`),
	FOREIGN KEY (`version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`output_version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`alias_kind`,`alias_id`) REFERENCES `model_configuration`(`kind`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`configuration_kind`,`configuration_id`) REFERENCES `model_configuration`(`kind`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`operation_kind`,`operation_id`) REFERENCES `model_operation`(`kind`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "model_record_alias_kind_check" CHECK("model_record"."alias_kind" = 'alias'),
	CONSTRAINT "model_record_parent_kind_check" CHECK("model_record"."configuration_kind" = 'policy' AND "model_record"."operation_kind" = 'training'),
	CONSTRAINT "model_record_shape_check" CHECK(("model_record"."kind" = 'evidence' AND "model_record"."version_id" IS NOT NULL AND "model_record"."event_kind" IS NOT NULL AND "model_record"."status" IS NOT NULL AND "model_record"."source" IS NOT NULL AND "model_record"."configuration_id" IS NULL AND "model_record"."alias_id" IS NULL AND "model_record"."operation_id" IS NULL) OR ("model_record"."kind" = 'policy_revision' AND "model_record"."configuration_id" IS NOT NULL AND "model_record"."ordinal" IS NOT NULL AND "model_record"."version_id" IS NULL AND "model_record"."alias_id" IS NULL AND "model_record"."operation_id" IS NULL) OR ("model_record"."kind" = 'alias_event' AND "model_record"."alias_id" IS NOT NULL AND "model_record"."event_kind" IS NOT NULL AND "model_record"."version_id" IS NULL AND "model_record"."configuration_id" IS NULL AND "model_record"."operation_id" IS NULL) OR ("model_record"."kind" = 'checkpoint' AND "model_record"."operation_id" IS NOT NULL AND "model_record"."ordinal" IS NOT NULL AND "model_record"."version_id" IS NULL AND "model_record"."configuration_id" IS NULL AND "model_record"."alias_id" IS NULL) OR ("model_record"."kind" = 'file' AND "model_record"."version_id" IS NOT NULL AND "model_record"."path" IS NOT NULL AND "model_record"."configuration_id" IS NULL AND "model_record"."alias_id" IS NULL AND "model_record"."operation_id" IS NULL) OR ("model_record"."kind" = 'cost' AND "model_record"."workspace_id" IS NOT NULL AND "model_record"."subject_type" IS NOT NULL AND "model_record"."subject_id" IS NOT NULL AND "model_record"."provider" IS NOT NULL AND "model_record"."usd" IS NOT NULL AND "model_record"."period_start" IS NOT NULL AND "model_record"."period_end" IS NOT NULL AND "model_record"."version_id" IS NULL AND "model_record"."configuration_id" IS NULL AND "model_record"."alias_id" IS NULL AND "model_record"."operation_id" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_record_file_path_idx` ON `model_record` (`version_id`,`path`) WHERE "model_record"."kind" = 'file';--> statement-breakpoint
CREATE INDEX `model_record_cost_period_idx` ON `model_record` (`kind`,`workspace_id`,`period_start`);--> statement-breakpoint
CREATE INDEX `model_record_cost_subject_idx` ON `model_record` (`kind`,`subject_type`,`subject_id`);--> statement-breakpoint
CREATE INDEX `model_record_evidence_idx` ON `model_record` (`kind`,`version_id`,`event_kind`,`created_at`);--> statement-breakpoint
CREATE INDEX `model_record_alias_idx` ON `model_record` (`kind`,`alias_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `model_record_revision_idx` ON `model_record` (`configuration_id`,`ordinal`);--> statement-breakpoint
CREATE UNIQUE INDEX `model_record_checkpoint_idx` ON `model_record` (`operation_id`,`ordinal`);--> statement-breakpoint
CREATE TABLE `notification_endpoint` (
	`id` text NOT NULL,
	`user_id` integer NOT NULL,
	`token` text,
	`environment` text,
	`app_bundle_id` text,
	`last_registered_at` text DEFAULT (CURRENT_TIMESTAMP),
	`invalidated_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`installation_id` text,
	`platform` text DEFAULT 'ios' NOT NULL,
	`endpoint_hash` text,
	`destination_json` text,
	`state` text DEFAULT 'registered',
	`failure_code` text,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY(`platform`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "notification_endpoint_required_fields" CHECK((platform = 'ios' AND id IS NOT NULL AND user_id IS NOT NULL AND token IS NOT NULL AND environment IS NOT NULL AND app_bundle_id IS NOT NULL AND last_registered_at IS NOT NULL AND created_at IS NOT NULL) OR (platform = 'web' AND id IS NOT NULL AND user_id IS NOT NULL AND installation_id IS NOT NULL AND platform IS NOT NULL AND endpoint_hash IS NOT NULL AND destination_json IS NOT NULL AND state IS NOT NULL AND created_at IS NOT NULL)),
	CONSTRAINT "notification_endpoint_shape_0" CHECK((platform = 'ios' AND token IS NOT NULL AND environment IN ('sandbox','production') AND app_bundle_id IS NOT NULL AND last_registered_at IS NOT NULL AND installation_id IS NULL) OR (platform = 'web' AND installation_id IS NOT NULL AND endpoint_hash IS NOT NULL AND destination_json IS NOT NULL AND state IN ('registered','failed','disabled') AND token IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_endpoint_token_idx` ON `notification_endpoint` (`token`) WHERE token IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `notification_endpoint_owner_installation_idx` ON `notification_endpoint` (`user_id`,`platform`,`installation_id`) WHERE platform = 'web';--> statement-breakpoint
CREATE UNIQUE INDEX `notification_endpoint_endpoint_idx` ON `notification_endpoint` (`platform`,`endpoint_hash`) WHERE platform = 'web';--> statement-breakpoint
CREATE INDEX `notification_endpoint_active_user_idx` ON `notification_endpoint` (`user_id`,`invalidated_at`) WHERE platform = 'ios';--> statement-breakpoint
CREATE INDEX `notification_endpoint_owner_platform_idx` ON `notification_endpoint` (`user_id`,`platform`,`updated_at`) WHERE platform = 'web';--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`description` text,
	`price` integer,
	`stripe_price_id` text,
	`included_credits` integer,
	`grace_credits` integer,
	`stripe_meter_id` text,
	`overage_price_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `project` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`colour` text DEFAULT '#2563EB' NOT NULL,
	`default_model_tier` text,
	`coding_enabled` integer DEFAULT false NOT NULL,
	`coding_execution_provider` text DEFAULT 'polychat' NOT NULL,
	`coding_installation_id` integer,
	`coding_repository` text,
	`coding_prompt_strategy` text DEFAULT 'auto' NOT NULL,
	`coding_should_commit` integer DEFAULT true NOT NULL,
	`coding_delivery_policy` text,
	`coding_environment_setup` text,
	`coding_environment_cache` text,
	`coding_cache_generation` integer DEFAULT 0 NOT NULL,
	`coding_timeout_seconds` integer DEFAULT 900 NOT NULL,
	`coding_inspection_window_seconds` integer DEFAULT 0 NOT NULL,
	`flow` text,
	`created_by` integer NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `project_workspace_id_idx` ON `project` (`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_workspace_name_idx` ON `project` (`workspace_id`,`name`) WHERE "project"."archived_at" IS NULL;--> statement-breakpoint
CREATE TABLE `project_task` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`objective` text NOT NULL,
	`execution_profile` text,
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
	`flow_snapshot` text,
	`runner` text,
	`created_by_user_id` integer NOT NULL,
	`assignee_user_id` integer,
	`runner_identity_user_id` integer,
	`conversation_id` text,
	`origin_conversation_id` text,
	`goal_id` text,
	`dispatch_task_id` text,
	`run_id` text,
	`completions` text,
	`position` real DEFAULT 0 NOT NULL,
	`token_budget` integer,
	`tokens_spent` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	`started_at` text,
	`completed_at` text,
	`attention_version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignee_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`runner_identity_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`origin_conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `conversation_run`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `project_task_project_status_idx` ON `project_task` (`project_id`,`status`,`position`);--> statement-breakpoint
CREATE INDEX `project_task_workspace_status_idx` ON `project_task` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `project_task_assignee_idx` ON `project_task` (`assignee_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_task_conversation_idx` ON `project_task` (`conversation_id`) WHERE "project_task"."conversation_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `project_task_run_idx` ON `project_task` (`run_id`);--> statement-breakpoint
CREATE INDEX `project_task_origin_conversation_idx` ON `project_task` (`origin_conversation_id`);--> statement-breakpoint
CREATE TABLE `project_task_integration` (
	`id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text NOT NULL,
	`task_id` text NOT NULL,
	`source_id` text NOT NULL,
	`owner_user_id` integer NOT NULL,
	`provider` text,
	`account_id` text,
	`external_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`target` text,
	`policy_id` text,
	`policy_revision` text,
	`publication_status` text DEFAULT 'unpublished',
	`publication_body` text,
	`published_url` text,
	`kind` text NOT NULL,
	PRIMARY KEY(`kind`, `id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `resource`(`source_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "project_task_integration_required_fields" CHECK((kind = 'import' AND id IS NOT NULL AND workspace_id IS NOT NULL AND project_id IS NOT NULL AND task_id IS NOT NULL AND source_id IS NOT NULL AND owner_user_id IS NOT NULL AND provider IS NOT NULL AND account_id IS NOT NULL AND external_id IS NOT NULL AND created_at IS NOT NULL) OR (kind = 'review' AND id IS NOT NULL AND workspace_id IS NOT NULL AND project_id IS NOT NULL AND task_id IS NOT NULL AND source_id IS NOT NULL AND owner_user_id IS NOT NULL AND target IS NOT NULL AND publication_status IS NOT NULL AND created_at IS NOT NULL)),
	CONSTRAINT "project_task_integration_shape_0" CHECK((kind = 'import' AND provider IS NOT NULL AND account_id IS NOT NULL AND external_id IS NOT NULL AND target IS NULL) OR (kind = 'review' AND target IS NOT NULL AND provider IS NULL AND publication_status IN ('unpublished','publishing','published','unknown')))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_task_integration_task_idx` ON `project_task_integration` (`task_id`,`kind`);--> statement-breakpoint
CREATE INDEX `project_task_integration_source_idx` ON `project_task_integration` (`source_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_task_integration_external_identity_idx` ON `project_task_integration` (`workspace_id`,`project_id`,`owner_user_id`,`provider`,`account_id`,`external_id`) WHERE kind = 'import';--> statement-breakpoint
CREATE INDEX `project_task_integration_project_created_idx` ON `project_task_integration` (`project_id`,`kind`,`created_at`);--> statement-breakpoint
CREATE TABLE `provider_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`provider` text NOT NULL,
	`kind` text NOT NULL,
	`external_id` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'connected' NOT NULL,
	`encrypted_data` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `provider_connection_user_provider_idx` ON `provider_connection` (`user_id`,`provider`);--> statement-breakpoint
CREATE UNIQUE INDEX `provider_connection_unique_idx` ON `provider_connection` (`user_id`,`provider`,`kind`,`external_id`);--> statement-breakpoint
CREATE TABLE `provider_session` (
	`session_type` text NOT NULL,
	`id` text NOT NULL,
	`remote_session_id` text,
	`kind` text,
	`user_id` integer NOT NULL,
	`provider` text NOT NULL,
	`toolkit_slug` text,
	`auth_config_id` text,
	`connected_account_id` text,
	`allowed_operation_ids` text,
	`run_id` text,
	`completion_id` text,
	`recipe_id` text,
	`installation_id` text,
	`project_id` text,
	`teammate_context_id` text,
	`state` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`expires_at` text,
	`claimed_at` text,
	`cleanup_attempts` integer DEFAULT 0,
	`cleanup_after` text,
	`conversation_id` text,
	`workspace_id` text,
	`credential_source` text,
	`provider_session_id` text,
	`tool_call_id` text,
	`input_hash` text,
	`creation_claimed` integer DEFAULT 0,
	`creation_started_at` integer,
	`last_error` text,
	`model` text,
	`destroyed_at` text,
	PRIMARY KEY(`session_type`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`installation_id`) REFERENCES `template`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`teammate_context_id`) REFERENCES `teammate_context`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "provider_session_shape" CHECK((session_type = 'connector' AND remote_session_id IS NOT NULL AND kind IS NOT NULL AND kind IN ('tool','connection') AND toolkit_slug IS NOT NULL AND allowed_operation_ids IS NOT NULL AND run_id IS NOT NULL AND state IS NOT NULL AND state IN ('active','claimed','cleanup_pending') AND expires_at IS NOT NULL AND cleanup_attempts IS NOT NULL AND conversation_id IS NULL AND credential_source IS NULL) OR (session_type = 'browser' AND conversation_id IS NOT NULL AND credential_source IS NOT NULL AND credential_source IN ('user','workspace') AND tool_call_id IS NOT NULL AND input_hash IS NOT NULL AND creation_claimed IS NOT NULL AND model IS NOT NULL AND remote_session_id IS NULL AND kind IS NULL AND state IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_session_remote_identity_idx` ON `provider_session` (`remote_session_id`) WHERE session_type = 'connector';--> statement-breakpoint
CREATE UNIQUE INDEX `provider_session_browser_identity_idx` ON `provider_session` (`user_id`,`conversation_id`,`tool_call_id`) WHERE session_type = 'browser';--> statement-breakpoint
CREATE INDEX `provider_session_conversation_idx` ON `provider_session` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `provider_session_expiry_idx` ON `provider_session` (`session_type`,`expires_at`);--> statement-breakpoint
CREATE INDEX `provider_session_cleanup_idx` ON `provider_session` (`session_type`,`state`,`cleanup_after`);--> statement-breakpoint
CREATE INDEX `provider_session_owner_provider_idx` ON `provider_session` (`session_type`,`user_id`,`provider`);--> statement-breakpoint
CREATE INDEX `provider_session_run_idx` ON `provider_session` (`session_type`,`run_id`);--> statement-breakpoint
CREATE INDEX `provider_session_context_idx` ON `provider_session` (`teammate_context_id`);--> statement-breakpoint
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
CREATE UNIQUE INDEX `resource_source_id_unique` ON `resource` (`source_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `resource_output_id_unique` ON `resource` (`output_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `resource_memory_id_unique` ON `resource` (`memory_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `resource_skill_id_unique` ON `resource` (`skill_id`);--> statement-breakpoint
CREATE INDEX `resource_scope_idx` ON `resource` (`resource_type`,`scope_type`,`scope_id`);--> statement-breakpoint
CREATE INDEX `resource_creator_idx` ON `resource` (`resource_type`,`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `resource_project_idx` ON `resource` (`resource_type`,`project_id`);--> statement-breakpoint
CREATE INDEX `resource_conversation_idx` ON `resource` (`resource_type`,`conversation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `resource_storage_idx` ON `resource` (`resource_type`,`storage_key`) WHERE storage_key IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `resource_memory_name_idx` ON `resource` (`scope_type`,`scope_id`,`title`) WHERE resource_type = 'memory' AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `resource_skill_name_idx` ON `resource` (`scope_type`,`scope_id`,`title`) WHERE resource_type = 'skill' AND archived_at IS NULL;--> statement-breakpoint
CREATE INDEX `resource_source_connection_idx` ON `resource` (`connection_id`) WHERE resource_type = 'source';--> statement-breakpoint
CREATE INDEX `resource_source_kind_idx` ON `resource` (`kind`) WHERE resource_type = 'source';--> statement-breakpoint
CREATE INDEX `resource_source_vector_idx` ON `resource` (`vector_id`) WHERE resource_type = 'source';--> statement-breakpoint
CREATE INDEX `resource_output_parent_idx` ON `resource` (`parent_output_id`) WHERE resource_type = 'output';--> statement-breakpoint
CREATE INDEX `resource_output_capability_idx` ON `resource` (`capability_id`) WHERE resource_type = 'output';--> statement-breakpoint
CREATE INDEX `resource_output_group_idx` ON `resource` (`group_id`) WHERE resource_type = 'output';--> statement-breakpoint
CREATE INDEX `resource_output_lookup_idx` ON `resource` (`created_by_user_id`,`capability_id`,`group_id`,`kind`) WHERE resource_type = 'output';--> statement-breakpoint
CREATE INDEX `resource_synthesis_owner_idx` ON `resource` (`created_by_user_id`,`created_at`) WHERE resource_type = 'synthesis';--> statement-breakpoint
CREATE INDEX `resource_synthesis_active_idx` ON `resource` (`created_by_user_id`,`namespace`,`is_active`,`created_at`) WHERE resource_type = 'synthesis';--> statement-breakpoint
CREATE TABLE `resource_collection` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_type` text DEFAULT 'source' NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`owner_user_id` integer,
	`project_id` text,
	`title` text NOT NULL,
	`normalised_name` text,
	`description` text,
	`kind` text DEFAULT 'general' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "resource_collection_scope_check" CHECK(("resource_collection"."collection_type" = 'source' AND "resource_collection"."owner_user_id" IS NULL) OR ("resource_collection"."collection_type" = 'conversation' AND "resource_collection"."normalised_name" IS NOT NULL AND (("resource_collection"."owner_user_id" IS NULL) <> ("resource_collection"."project_id" IS NULL))))
);
--> statement-breakpoint
CREATE INDEX `resource_collection_creator_idx` ON `resource_collection` (`collection_type`,`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `resource_collection_project_idx` ON `resource_collection` (`collection_type`,`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `resource_collection_personal_group_name_idx` ON `resource_collection` (`owner_user_id`,`normalised_name`) WHERE "resource_collection"."collection_type" = 'conversation' AND "resource_collection"."owner_user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `resource_collection_project_group_name_idx` ON `resource_collection` (`project_id`,`normalised_name`) WHERE "resource_collection"."collection_type" = 'conversation' AND "resource_collection"."project_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `resource_grant` (
	`kind` text NOT NULL,
	`id` text DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`workspace_id` text,
	`user_id` integer,
	`role` text,
	`email` text,
	`status` text,
	`accepted_by` integer,
	`accepted_at` text,
	`conversation_id` text,
	`delegation_id` text,
	`granted_by` text,
	`output_id` text,
	`token_hash` text,
	`permission` text DEFAULT 'view',
	`created_by_user_id` integer,
	`context_id` text,
	`connection_id` text,
	`allowed_operations` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`expires_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY(`kind`, `id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accepted_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`delegation_id`) REFERENCES `delegation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`output_id`) REFERENCES `resource`(`output_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`context_id`) REFERENCES `teammate_context`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `provider_connection`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "resource_grant_organisation_shape" CHECK(
      ("resource_grant"."kind" NOT IN ('membership', 'invitation') AND "resource_grant"."workspace_id" IS NULL AND "resource_grant"."user_id" IS NULL AND "resource_grant"."role" IS NULL AND "resource_grant"."email" IS NULL AND "resource_grant"."status" IS NULL AND "resource_grant"."accepted_by" IS NULL AND "resource_grant"."accepted_at" IS NULL)
      OR ("resource_grant"."kind" = 'membership' AND "resource_grant"."workspace_id" IS NOT NULL AND "resource_grant"."user_id" IS NOT NULL AND "resource_grant"."role" IS NOT NULL AND "resource_grant"."email" IS NULL AND "resource_grant"."status" IS NULL AND "resource_grant"."accepted_by" IS NULL AND "resource_grant"."accepted_at" IS NULL AND "resource_grant"."created_by_user_id" IS NULL AND "resource_grant"."token_hash" IS NULL AND "resource_grant"."expires_at" IS NULL AND "resource_grant"."revoked_at" IS NULL)
      OR ("resource_grant"."kind" = 'invitation' AND "resource_grant"."workspace_id" IS NOT NULL AND "resource_grant"."user_id" IS NULL AND "resource_grant"."role" IS NOT NULL AND "resource_grant"."email" IS NOT NULL AND "resource_grant"."status" IS NOT NULL AND "resource_grant"."created_by_user_id" IS NOT NULL AND "resource_grant"."token_hash" IS NOT NULL AND "resource_grant"."expires_at" IS NOT NULL)
    ),
	CONSTRAINT "resource_grant_shape_check" CHECK(
      ("resource_grant"."kind" = 'conversation' AND "resource_grant"."conversation_id" IS NOT NULL AND "resource_grant"."delegation_id" IS NOT NULL AND "resource_grant"."granted_by" IS NOT NULL AND "resource_grant"."granted_by" IN ('spawn', 'user') AND "resource_grant"."output_id" IS NULL AND "resource_grant"."context_id" IS NULL AND "resource_grant"."connection_id" IS NULL AND "resource_grant"."token_hash" IS NULL AND "resource_grant"."created_by_user_id" IS NULL AND "resource_grant"."allowed_operations" IS NULL)
      OR ("resource_grant"."kind" = 'output' AND "resource_grant"."output_id" IS NOT NULL AND "resource_grant"."token_hash" IS NOT NULL AND "resource_grant"."permission" IS NOT NULL AND "resource_grant"."created_by_user_id" IS NOT NULL AND "resource_grant"."conversation_id" IS NULL AND "resource_grant"."delegation_id" IS NULL AND "resource_grant"."context_id" IS NULL AND "resource_grant"."connection_id" IS NULL AND "resource_grant"."granted_by" IS NULL AND "resource_grant"."allowed_operations" IS NULL)
      OR ("resource_grant"."kind" = 'connection' AND "resource_grant"."context_id" IS NOT NULL AND "resource_grant"."connection_id" IS NOT NULL AND "resource_grant"."allowed_operations" IS NOT NULL AND "resource_grant"."conversation_id" IS NULL AND "resource_grant"."delegation_id" IS NULL AND "resource_grant"."output_id" IS NULL AND "resource_grant"."token_hash" IS NULL AND "resource_grant"."created_by_user_id" IS NULL AND "resource_grant"."granted_by" IS NULL AND "resource_grant"."expires_at" IS NULL AND "resource_grant"."revoked_at" IS NULL)
      OR ("resource_grant"."kind" IN ('membership', 'invitation') AND "resource_grant"."conversation_id" IS NULL AND "resource_grant"."delegation_id" IS NULL AND "resource_grant"."granted_by" IS NULL AND "resource_grant"."output_id" IS NULL AND "resource_grant"."context_id" IS NULL AND "resource_grant"."connection_id" IS NULL AND "resource_grant"."allowed_operations" IS NULL)
    )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_grant_delegation_idx` ON `resource_grant` (`delegation_id`) WHERE "resource_grant"."delegation_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `resource_grant_conversation_idx` ON `resource_grant` (`conversation_id`) WHERE "resource_grant"."conversation_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `resource_grant_token_idx` ON `resource_grant` (`kind`,`token_hash`) WHERE "resource_grant"."token_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `resource_grant_output_idx` ON `resource_grant` (`output_id`) WHERE "resource_grant"."output_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `resource_grant_context_connection_idx` ON `resource_grant` (`context_id`,`connection_id`) WHERE "resource_grant"."context_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `resource_grant_connection_idx` ON `resource_grant` (`connection_id`) WHERE "resource_grant"."connection_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `resource_grant_membership_idx` ON `resource_grant` (`workspace_id`,`user_id`) WHERE "resource_grant"."kind" = 'membership';--> statement-breakpoint
CREATE INDEX `resource_grant_member_user_idx` ON `resource_grant` (`user_id`,`workspace_id`) WHERE "resource_grant"."kind" = 'membership';--> statement-breakpoint
CREATE UNIQUE INDEX `resource_grant_invitation_email_idx` ON `resource_grant` (`workspace_id`,`email`) WHERE "resource_grant"."kind" = 'invitation';--> statement-breakpoint
CREATE INDEX `resource_grant_invitation_status_idx` ON `resource_grant` (`workspace_id`,`status`) WHERE "resource_grant"."kind" = 'invitation';--> statement-breakpoint
CREATE INDEX `resource_grant_workspace_idx` ON `resource_grant` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `resource_grant_accepted_by_idx` ON `resource_grant` (`accepted_by`);--> statement-breakpoint
CREATE TABLE `resource_link` (
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
	CONSTRAINT "resource_link_shape_check" CHECK(("resource_link"."kind" = 'output_source' AND "resource_link"."output_id" IS NOT NULL AND "resource_link"."source_id" IS NOT NULL AND "resource_link"."collection_id" IS NULL AND "resource_link"."from_version_id" IS NULL AND "resource_link"."to_version_id" IS NULL AND "resource_link"."relation" IS NULL) OR ("resource_link"."kind" = 'source_collection' AND "resource_link"."collection_id" IS NOT NULL AND "resource_link"."source_id" IS NOT NULL AND "resource_link"."output_id" IS NULL AND "resource_link"."from_version_id" IS NULL AND "resource_link"."to_version_id" IS NULL AND "resource_link"."relation" IS NULL) OR ("resource_link"."kind" = 'model_lineage' AND "resource_link"."from_version_id" IS NOT NULL AND "resource_link"."to_version_id" IS NOT NULL AND "resource_link"."relation" IS NOT NULL AND "resource_link"."output_id" IS NULL AND "resource_link"."collection_id" IS NULL AND "resource_link"."source_id" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_link_output_source_idx` ON `resource_link` (`output_id`,`source_id`) WHERE "resource_link"."kind" = 'output_source';--> statement-breakpoint
CREATE UNIQUE INDEX `resource_link_collection_source_idx` ON `resource_link` (`collection_id`,`source_id`) WHERE "resource_link"."kind" = 'source_collection';--> statement-breakpoint
CREATE UNIQUE INDEX `resource_link_lineage_idx` ON `resource_link` (`from_version_id`,`to_version_id`,`relation`) WHERE "resource_link"."kind" = 'model_lineage';--> statement-breakpoint
CREATE INDEX `resource_link_source_idx` ON `resource_link` (`kind`,`source_id`);--> statement-breakpoint
CREATE INDEX `resource_link_lineage_target_idx` ON `resource_link` (`kind`,`to_version_id`);--> statement-breakpoint
CREATE TABLE `resource_revision` (
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
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "resource_revision_required_fields" CHECK((resource_type = 'memory' AND id IS NOT NULL AND document_id IS NOT NULL AND revision IS NOT NULL AND text_content IS NOT NULL AND created_by IS NOT NULL AND created_at IS NOT NULL) OR (resource_type = 'skill' AND id IS NOT NULL AND skill_id IS NOT NULL AND revision IS NOT NULL AND description IS NOT NULL AND digest IS NOT NULL AND storage_key IS NOT NULL AND size IS NOT NULL AND created_by IS NOT NULL AND created_at IS NOT NULL) OR (resource_type = 'output' AND output_id IS NOT NULL AND revision IS NOT NULL AND title IS NOT NULL AND status IS NOT NULL AND sensitivity IS NOT NULL AND content IS NOT NULL AND created_by_user_id IS NOT NULL AND created_at IS NOT NULL)),
	CONSTRAINT "resource_revision_shape_0" CHECK((resource_type = 'memory' AND document_id IS NOT NULL AND skill_id IS NULL AND output_id IS NULL AND text_content IS NOT NULL AND created_by IS NOT NULL) OR (resource_type = 'skill' AND skill_id IS NOT NULL AND document_id IS NULL AND output_id IS NULL AND description IS NOT NULL AND digest IS NOT NULL AND storage_key IS NOT NULL AND size IS NOT NULL AND size >= 0 AND revision >= 1 AND created_by IS NOT NULL) OR (resource_type = 'output' AND output_id IS NOT NULL AND document_id IS NULL AND skill_id IS NULL AND title IS NOT NULL AND status IN ('pending','ready','failed','archived') AND sensitivity IN ('personal','internal','confidential') AND content IS NOT NULL AND created_by_user_id IS NOT NULL)),
	CONSTRAINT "resource_revision_shape_1" CHECK((source_skill_id IS NULL AND source_revision_id IS NULL) OR (source_skill_id IS NOT NULL AND source_revision_id IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_revision_memory_revision_idx` ON `resource_revision` (`document_id`,`revision`) WHERE document_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `resource_revision_memory_operation_idx` ON `resource_revision` (`document_id`,`operation_id`) WHERE document_id IS NOT NULL AND operation_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `resource_revision_skill_revision_idx` ON `resource_revision` (`skill_id`,`revision`) WHERE skill_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `resource_revision_output_revision_idx` ON `resource_revision` (`output_id`,`revision`) WHERE output_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `resource_revision_storage_key_idx` ON `resource_revision` (`storage_key`) WHERE storage_key IS NOT NULL;--> statement-breakpoint
CREATE TABLE `scoped_configuration` (
	`kind` text NOT NULL,
	`id` text NOT NULL,
	`user_id` integer,
	`project_id` text,
	`workspace_id` text,
	`owner_user_id` integer,
	`connection_id` text,
	`account_id` text,
	`revision` text,
	`scope_type` text GENERATED ALWAYS AS (CASE WHEN project_id IS NOT NULL THEN 'project' ELSE 'user' END) VIRTUAL,
	`scope_id` text GENERATED ALWAYS AS (COALESCE(project_id, CAST(user_id AS TEXT))) VIRTUAL,
	`target_kind` text DEFAULT '' NOT NULL,
	`target_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`encrypted_value` text,
	`public_key` text,
	`enabled` integer,
	`attached` integer DEFAULT false NOT NULL,
	`excluded` integer DEFAULT false NOT NULL,
	`created_by` integer,
	`configuration_id` text,
	`configuration_created_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY(`kind`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `provider_connection`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "scoped_configuration_review_shape" CHECK("scoped_configuration"."kind" = 'review_policy' OR ("scoped_configuration"."workspace_id" IS NULL AND "scoped_configuration"."owner_user_id" IS NULL AND "scoped_configuration"."connection_id" IS NULL AND "scoped_configuration"."account_id" IS NULL AND "scoped_configuration"."revision" IS NULL)),
	CONSTRAINT "scoped_configuration_scope_check" CHECK(("scoped_configuration"."user_id" IS NOT NULL) != ("scoped_configuration"."project_id" IS NOT NULL)),
	CONSTRAINT "scoped_configuration_kind_check" CHECK(("scoped_configuration"."kind" IN ('preferences', 'provider', 'model') AND "scoped_configuration"."user_id" IS NOT NULL AND ("scoped_configuration"."kind" != 'provider' OR "scoped_configuration"."target_id" IS NOT NULL)) OR ("scoped_configuration"."kind" = 'capability' AND "scoped_configuration"."target_id" IS NOT NULL) OR ("scoped_configuration"."kind" = 'environment' AND "scoped_configuration"."project_id" IS NOT NULL AND "scoped_configuration"."target_id" IS NOT NULL AND "scoped_configuration"."encrypted_value" IS NOT NULL) OR ("scoped_configuration"."kind" = 'review_policy' AND "scoped_configuration"."project_id" IS NOT NULL AND "scoped_configuration"."workspace_id" IS NOT NULL AND "scoped_configuration"."owner_user_id" IS NOT NULL AND "scoped_configuration"."connection_id" IS NOT NULL AND "scoped_configuration"."account_id" IS NOT NULL AND "scoped_configuration"."target_id" IS NOT NULL AND "scoped_configuration"."enabled" IS NOT NULL AND "scoped_configuration"."revision" IS NOT NULL AND json_extract("scoped_configuration"."payload", '$.token_budget') IS NOT NULL)),
	CONSTRAINT "scoped_configuration_attachment_check" CHECK("scoped_configuration"."attached" = 0 OR ("scoped_configuration"."kind" = 'capability' AND "scoped_configuration"."project_id" IS NOT NULL AND "scoped_configuration"."created_by" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `scoped_configuration_user_target_idx` ON `scoped_configuration` (`user_id`,`kind`,`target_id`);--> statement-breakpoint
CREATE INDEX `scoped_configuration_project_target_idx` ON `scoped_configuration` (`project_id`,`kind`,`target_kind`,`target_id`);--> statement-breakpoint
CREATE INDEX `scoped_configuration_target_idx` ON `scoped_configuration` (`kind`,`target_kind`,`target_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `scoped_configuration_capability_idx` ON `scoped_configuration` (`scope_type`,`scope_id`,`target_kind`,`target_id`) WHERE "scoped_configuration"."kind" = 'capability';--> statement-breakpoint
CREATE UNIQUE INDEX `scoped_configuration_environment_idx` ON `scoped_configuration` (`project_id`,`target_id`) WHERE "scoped_configuration"."kind" = 'environment';--> statement-breakpoint
CREATE UNIQUE INDEX `scoped_configuration_review_identity_idx` ON `scoped_configuration` (`workspace_id`,`project_id`,`target_kind`,`connection_id`,`target_id`) WHERE "scoped_configuration"."kind" = 'review_policy';--> statement-breakpoint
CREATE INDEX `scoped_configuration_review_repository_idx` ON `scoped_configuration` (`target_kind`,`account_id`,`target_id`,`enabled`) WHERE "scoped_configuration"."kind" = 'review_policy';--> statement-breakpoint
CREATE INDEX `scoped_configuration_workspace_idx` ON `scoped_configuration` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `scoped_configuration_owner_idx` ON `scoped_configuration` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `scoped_configuration_connection_idx` ON `scoped_configuration` (`connection_id`);--> statement-breakpoint
CREATE TABLE `search_chunk` (
	`id` text NOT NULL,
	`document_id` text NOT NULL,
	`vector_id` text,
	`chunk_index` integer NOT NULL,
	`content` text NOT NULL,
	`metadata` text,
	`lifecycle_status` text DEFAULT 'pending',
	`provider` text,
	`provider_target` text DEFAULT 'quarantined-legacy',
	`embedding_model` text DEFAULT 'unknown-legacy',
	`vector_space` text,
	`vector_space_version` text DEFAULT 'legacy',
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	`embedding_dimensions` integer DEFAULT 1,
	`distance_metric` text DEFAULT 'unknown',
	`task_mode` text DEFAULT 'unknown',
	`title` text,
	`document_type` text NOT NULL,
	PRIMARY KEY(`document_type`, `id`),
	FOREIGN KEY (`document_type`,`document_id`) REFERENCES `search_document`(`document_type`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "search_chunk_shape_0" CHECK(document_type IN ('embedding', 'source')),
	CONSTRAINT "search_chunk_shape_1" CHECK(document_type != 'embedding' OR lifecycle_status IN ('pending','active','delete_pending')),
	CONSTRAINT "search_chunk_shape_2" CHECK((document_type = 'embedding' AND id IS NOT NULL AND document_id IS NOT NULL AND vector_id IS NOT NULL AND chunk_index IS NOT NULL AND content IS NOT NULL AND metadata IS NOT NULL AND lifecycle_status IS NOT NULL AND provider IS NOT NULL AND provider_target IS NOT NULL AND embedding_model IS NOT NULL AND vector_space IS NOT NULL AND vector_space_version IS NOT NULL AND created_at IS NOT NULL AND embedding_dimensions IS NOT NULL AND distance_metric IS NOT NULL AND task_mode IS NOT NULL) OR (document_type = 'source' AND id IS NOT NULL AND document_id IS NOT NULL AND chunk_index IS NOT NULL AND title IS NOT NULL AND content IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_chunk_embedding_ordinal_idx` ON `search_chunk` (`document_id`,`chunk_index`) WHERE document_type = 'embedding';--> statement-breakpoint
CREATE UNIQUE INDEX `search_chunk_embedding_vector_idx` ON `search_chunk` (`vector_id`) WHERE document_type = 'embedding';--> statement-breakpoint
CREATE INDEX `search_chunk_document_idx` ON `search_chunk` (`document_type`,`document_id`);--> statement-breakpoint
CREATE INDEX `search_chunk_embedding_lifecycle_idx` ON `search_chunk` (`document_id`,`lifecycle_status`) WHERE document_type = 'embedding';--> statement-breakpoint
CREATE TABLE `search_document` (
	`id` text NOT NULL,
	`metadata` text,
	`title` text,
	`content` text,
	`type` text,
	`namespace` text,
	`user_id` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	`scope_type` text DEFAULT 'personal',
	`logical_id` text,
	`lifecycle_status` text DEFAULT 'pending',
	`provider` text,
	`provider_target` text DEFAULT 'quarantined-legacy',
	`embedding_model` text DEFAULT 'unknown-legacy',
	`vector_space` text,
	`vector_space_version` text DEFAULT 'legacy',
	`embedding_dimensions` integer DEFAULT 1,
	`distance_metric` text DEFAULT 'unknown',
	`task_mode` text DEFAULT 'unknown',
	`source_id` text,
	`source_revision` integer,
	`project_id` text,
	`status` text DEFAULT 'lexical',
	`target` text,
	`lease_token` text,
	`lease_expires_at` text,
	`document_type` text NOT NULL,
	`legacy_user_id` integer GENERATED ALWAYS AS (CASE WHEN document_type = 'legacy' THEN user_id END) VIRTUAL,
	`embedding_user_id` integer GENERATED ALWAYS AS (CASE WHEN document_type = 'embedding' THEN user_id END) VIRTUAL,
	PRIMARY KEY(`document_type`, `id`),
	FOREIGN KEY (`legacy_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`embedding_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "search_document_shape_0" CHECK(document_type IN ('legacy', 'embedding', 'source')),
	CONSTRAINT "search_document_shape_1" CHECK(document_type != 'embedding' OR (scope_type = 'personal' AND lifecycle_status IN ('pending','active','delete_pending'))),
	CONSTRAINT "search_document_shape_2" CHECK(document_type != 'source' OR (status IN ('lexical','active','stale') AND source_revision > 0)),
	CONSTRAINT "search_document_shape_3" CHECK((document_type = 'legacy' AND id IS NOT NULL AND created_at IS NOT NULL) OR (document_type = 'embedding' AND id IS NOT NULL AND scope_type IS NOT NULL AND user_id IS NOT NULL AND logical_id IS NOT NULL AND type IS NOT NULL AND title IS NOT NULL AND metadata IS NOT NULL AND lifecycle_status IS NOT NULL AND provider IS NOT NULL AND provider_target IS NOT NULL AND embedding_model IS NOT NULL AND vector_space IS NOT NULL AND vector_space_version IS NOT NULL AND created_at IS NOT NULL AND embedding_dimensions IS NOT NULL AND distance_metric IS NOT NULL AND task_mode IS NOT NULL) OR (document_type = 'source' AND id IS NOT NULL AND source_id IS NOT NULL AND source_revision IS NOT NULL AND user_id IS NOT NULL AND status IS NOT NULL AND target IS NOT NULL AND created_at IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `search_document_legacy_namespace_idx` ON `search_document` (`namespace`) WHERE document_type = 'legacy';--> statement-breakpoint
CREATE INDEX `search_document_legacy_user_idx` ON `search_document` (`user_id`) WHERE document_type = 'legacy';--> statement-breakpoint
CREATE INDEX `search_document_legacy_scope_idx` ON `search_document` (`id`,`type`,`namespace`,`user_id`) WHERE document_type = 'legacy';--> statement-breakpoint
CREATE UNIQUE INDEX `search_document_embedding_logical_idx` ON `search_document` (`user_id`,`logical_id`) WHERE document_type = 'embedding';--> statement-breakpoint
CREATE INDEX `search_document_embedding_lifecycle_idx` ON `search_document` (`user_id`,`lifecycle_status`) WHERE document_type = 'embedding';--> statement-breakpoint
CREATE UNIQUE INDEX `search_document_source_revision_idx` ON `search_document` (`source_id`,`source_revision`) WHERE document_type = 'source';--> statement-breakpoint
CREATE INDEX `search_document_source_scope_idx` ON `search_document` (`project_id`,`status`) WHERE document_type = 'source';--> statement-breakpoint
CREATE INDEX `search_document_source_status_idx` ON `search_document` (`status`) WHERE document_type = 'source';--> statement-breakpoint
CREATE INDEX `search_document_legacy_owner_idx` ON `search_document` (`legacy_user_id`) WHERE legacy_user_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX `search_document_embedding_owner_idx` ON `search_document` (`embedding_user_id`) WHERE embedding_user_id IS NOT NULL;--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	`jwt_token` text,
	`jwt_expires_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `source_knowledge_sync` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`project_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`recipe_id` text NOT NULL,
	`integration_id` text NOT NULL,
	`title` text NOT NULL,
	`resources` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`interval_minutes` integer DEFAULT 60 NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL,
	`generation` integer DEFAULT 1 NOT NULL,
	`next_sync_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`last_successful_at` text,
	`last_error` text,
	`lease_token` text,
	`lease_expires_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `provider_connection`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `source_knowledge_sync_due_idx` ON `source_knowledge_sync` (`status`,`next_sync_at`);--> statement-breakpoint
CREATE INDEX `source_knowledge_sync_project_idx` ON `source_knowledge_sync` (`project_id`);--> statement-breakpoint
CREATE TABLE `task_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`execution_time_ms` integer,
	`error_message` text,
	`result_data` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `task_executions_task_id_idx` ON `task_executions` (`task_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`task_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`priority` integer DEFAULT 5,
	`user_id` integer,
	`project_id` text,
	`task_data` text,
	`schedule_type` text DEFAULT 'immediate',
	`scheduled_at` text,
	`cron_expression` text,
	`created_by` text NOT NULL,
	`attempts` integer DEFAULT 0,
	`max_attempts` integer DEFAULT 3,
	`last_attempted_at` text,
	`execution_owner_token` text,
	`execution_lease_expires_at` text,
	`completed_at` text,
	`error_message` text,
	`metadata` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tasks_user_id_idx` ON `tasks` (`user_id`);--> statement-breakpoint
CREATE INDEX `tasks_project_id_idx` ON `tasks` (`project_id`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_task_type_idx` ON `tasks` (`task_type`);--> statement-breakpoint
CREATE INDEX `tasks_scheduled_at_idx` ON `tasks` (`scheduled_at`);--> statement-breakpoint
CREATE INDEX `tasks_execution_lease_idx` ON `tasks` (`status`,`execution_lease_expires_at`);--> statement-breakpoint
CREATE TABLE `teammate_context` (
	`id` text PRIMARY KEY NOT NULL,
	`computer_id` text,
	`computer_provider` text,
	`computer_provider_handle` text,
	`computer_checkpoint_reference` text,
	`computer_status` text,
	`computer_lease_kind` text,
	`computer_lease_owner_id` text,
	`computer_lease_expires_at` text,
	`computer_lease_fence` integer,
	`computer_last_error` text,
	`computer_created_at` text,
	`computer_updated_at` text,
	`teammate_id` text NOT NULL,
	`actor_user_id` integer NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text NOT NULL,
	`home_conversation_id` text NOT NULL,
	`memory_document_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`teammate_id`) REFERENCES `teammates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`home_conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`memory_document_id`) REFERENCES `resource`(`memory_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "teammate_context_computer_shape_check" CHECK(computer_id IS NULL OR (computer_provider IS NOT NULL AND computer_status IS NOT NULL AND computer_lease_fence IS NOT NULL AND computer_created_at IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teammate_context_computer_identity_idx` ON `teammate_context` (`computer_id`);--> statement-breakpoint
CREATE INDEX `teammate_context_computer_lease_idx` ON `teammate_context` (`computer_lease_expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `teammate_context_identity_idx` ON `teammate_context` (`teammate_id`,`actor_user_id`,`scope_type`,`scope_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `teammate_context_home_conversation_idx` ON `teammate_context` (`home_conversation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `teammate_context_memory_document_idx` ON `teammate_context` (`memory_document_id`);--> statement-breakpoint
CREATE TABLE `teammates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`owner_scope_type` text DEFAULT 'user' NOT NULL,
	`owner_scope_id` text DEFAULT '' NOT NULL,
	`derived_from_teammate_id` text,
	`kind` text DEFAULT 'colleague' NOT NULL,
	`workspace_default` integer DEFAULT false NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`avatar_url` text,
	`servers` text NOT NULL,
	`model` text,
	`temperature` text,
	`max_steps` integer,
	`system_prompt` text,
	`few_shot_examples` text,
	`enabled_tools` text,
	`skill_ids` text,
	`mode` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `teammates_user_id_idx` ON `teammates` (`user_id`);--> statement-breakpoint
CREATE INDEX `teammates_owner_scope_idx` ON `teammates` (`owner_scope_type`,`owner_scope_id`);--> statement-breakpoint
CREATE TABLE `template` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`workspace_id` text,
	`project_id` text,
	`kind` text NOT NULL,
	`capability_id` text,
	`publication_id` text,
	`source_teammate_id` text,
	`avatar_url` text,
	`category` text,
	`tags` text,
	`is_featured` integer DEFAULT false,
	`is_public` integer DEFAULT true,
	`usage_count` integer DEFAULT 0,
	`rating_count` integer DEFAULT 0,
	`rating_average` text DEFAULT '0',
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`configuration` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_teammate_id`) REFERENCES `teammates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `template_publication_id_idx` ON `template` (`publication_id`);--> statement-breakpoint
CREATE INDEX `template_publication_source_idx` ON `template` (`source_teammate_id`);--> statement-breakpoint
CREATE INDEX `template_publication_category_idx` ON `template` (`kind`,`is_public`,`category`);--> statement-breakpoint
CREATE INDEX `template_publication_featured_idx` ON `template` (`kind`,`is_public`,`is_featured`,`usage_count`);--> statement-breakpoint
CREATE INDEX `template_publication_usage_idx` ON `template` (`kind`,`is_public`,`usage_count`,`created_at`);--> statement-breakpoint
CREATE INDEX `template_publication_rating_idx` ON `template` (`kind`,`is_public`,CAST(rating_average AS REAL),`rating_count`,`created_at`);--> statement-breakpoint
CREATE INDEX `template_publication_recent_idx` ON `template` (`kind`,`is_public`,`created_at`);--> statement-breakpoint
CREATE INDEX `template_created_by_user_id_idx` ON `template` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `template_workspace_id_idx` ON `template` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `template_project_id_idx` ON `template` (`project_id`);--> statement-breakpoint
CREATE INDEX `template_capability_id_idx` ON `template` (`capability_id`);--> statement-breakpoint
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
CREATE INDEX `training_examples_user_id_idx` ON `training_examples` (`user_id`);--> statement-breakpoint
CREATE INDEX `training_examples_conversation_id_idx` ON `training_examples` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `training_examples_source_idx` ON `training_examples` (`source`);--> statement-breakpoint
CREATE INDEX `training_examples_app_name_idx` ON `training_examples` (`app_name`);--> statement-breakpoint
CREATE INDEX `training_examples_exported_idx` ON `training_examples` (`exported`);--> statement-breakpoint
CREATE INDEX `training_examples_include_in_training_idx` ON `training_examples` (`include_in_training`);--> statement-breakpoint
CREATE INDEX `training_examples_feedback_rating_idx` ON `training_examples` (`feedback_rating`);--> statement-breakpoint
CREATE INDEX `training_examples_quality_score_idx` ON `training_examples` (`quality_score`);--> statement-breakpoint
CREATE INDEX `training_examples_task_category_idx` ON `training_examples` (`task_category`);--> statement-breakpoint
CREATE INDEX `training_examples_difficulty_level_idx` ON `training_examples` (`difficulty_level`);--> statement-breakpoint
CREATE INDEX `training_examples_language_code_idx` ON `training_examples` (`language_code`);--> statement-breakpoint
CREATE INDEX `training_examples_conversation_turn_idx` ON `training_examples` (`conversation_turn`);--> statement-breakpoint
CREATE TABLE `usage_balance` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`period` text NOT NULL,
	`plan_id` text,
	`included_credit_micros` integer DEFAULT 0 NOT NULL,
	`grace_credit_micros` integer DEFAULT 0 NOT NULL,
	`spent_credit_micros` integer DEFAULT 0 NOT NULL,
	`reserved_credit_micros` integer DEFAULT 0 NOT NULL,
	`overrun_credit_micros` integer DEFAULT 0 NOT NULL,
	`overage_credit_micros` integer DEFAULT 0 NOT NULL,
	`stripe_synced_overage_credit_micros` integer DEFAULT 0 NOT NULL,
	`overage_enabled` integer DEFAULT false NOT NULL,
	`last_event_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usage_balance_user_period_idx` ON `usage_balance` (`user_id`,`period`);--> statement-breakpoint
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
	`run_id` text,
	`run_attempt` integer,
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
	`vendor_units` real,
	`reason` text,
	`site` text,
	`raw` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usage_event_idempotency_key_unique` ON `usage_event` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `usage_event_user_period_idx` ON `usage_event` (`user_id`,`period`);--> statement-breakpoint
CREATE INDEX `usage_event_period_source_idx` ON `usage_event` (`period`,`source`);--> statement-breakpoint
CREATE INDEX `usage_event_conversation_idx` ON `usage_event` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `usage_event_run_idx` ON `usage_event` (`run_id`,`run_attempt`);--> statement-breakpoint
CREATE INDEX `usage_event_workspace_period_idx` ON `usage_event` (`workspace_id`,`period`);--> statement-breakpoint
CREATE TABLE `usage_reservation` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`period` text NOT NULL,
	`kind` text NOT NULL,
	`ref_id` text NOT NULL,
	`credit_micros` integer NOT NULL,
	`status` text NOT NULL,
	`expires_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usage_reservation_kind_ref_idx` ON `usage_reservation` (`kind`,`ref_id`);--> statement-breakpoint
CREATE INDEX `usage_reservation_user_period_idx` ON `usage_reservation` (`user_id`,`period`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text,
	`avatar_url` text,
	`email` text NOT NULL,
	`github_username` text,
	`company` text,
	`site` text,
	`location` text,
	`bio` text,
	`twitter_username` text,
	`role` text DEFAULT 'user',
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	`setup_at` text,
	`terms_accepted_at` text,
	`plan_id` text,
	`message_count` integer DEFAULT 0,
	`last_active_at` text,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`task_notification_preferences` text,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `user_credential` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`user_id` integer NOT NULL,
	`public_id` text,
	`provider` text,
	`external_id` text,
	`encrypted_value` text,
	`token_hash` text,
	`name` text DEFAULT 'API Key',
	`public_key` text,
	`counter` integer,
	`device_type` text,
	`backed_up` integer,
	`transports` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "user_credential_shape_check" CHECK(
      ("user_credential"."kind" = 'oauth' AND "user_credential"."public_id" IS NULL AND "user_credential"."encrypted_value" IS NULL AND "user_credential"."token_hash" IS NULL AND "user_credential"."public_key" IS NULL AND "user_credential"."counter" IS NULL AND "user_credential"."device_type" IS NULL AND "user_credential"."backed_up" IS NULL AND "user_credential"."transports" IS NULL)
      OR ("user_credential"."kind" = 'api_key' AND "user_credential"."public_id" IS NOT NULL AND "user_credential"."encrypted_value" IS NOT NULL AND "user_credential"."token_hash" IS NOT NULL AND "user_credential"."provider" IS NULL AND "user_credential"."external_id" IS NULL AND "user_credential"."public_key" IS NULL AND "user_credential"."counter" IS NULL AND "user_credential"."device_type" IS NULL AND "user_credential"."backed_up" IS NULL AND "user_credential"."transports" IS NULL)
      OR ("user_credential"."kind" = 'passkey' AND "user_credential"."external_id" IS NOT NULL AND "user_credential"."public_key" IS NOT NULL AND "user_credential"."counter" IS NOT NULL AND "user_credential"."device_type" IS NOT NULL AND "user_credential"."backed_up" IS NOT NULL AND "user_credential"."public_id" IS NULL AND "user_credential"."provider" IS NULL AND "user_credential"."encrypted_value" IS NULL AND "user_credential"."token_hash" IS NULL)
    )
);
--> statement-breakpoint
CREATE INDEX `user_credential_owner_idx` ON `user_credential` (`user_id`,`kind`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_credential_oauth_identity_idx` ON `user_credential` (`provider`,`external_id`) WHERE "user_credential"."kind" = 'oauth';--> statement-breakpoint
CREATE UNIQUE INDEX `user_credential_api_public_id_idx` ON `user_credential` (`public_id`) WHERE "user_credential"."kind" = 'api_key';--> statement-breakpoint
CREATE UNIQUE INDEX `user_credential_api_hash_idx` ON `user_credential` (`token_hash`) WHERE "user_credential"."kind" = 'api_key';--> statement-breakpoint
CREATE UNIQUE INDEX `user_credential_passkey_id_idx` ON `user_credential` (`external_id`) WHERE "user_credential"."kind" = 'passkey';--> statement-breakpoint
CREATE TABLE `user_pet` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`origin` text NOT NULL,
	`sheet_key` text NOT NULL,
	`layout_id` text DEFAULT 'polychat-v1' NOT NULL,
	`prompt` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_pet_user_id_idx` ON `user_pet` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_resource_state` (
	`id` text DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`user_id` integer NOT NULL,
	`saved_conversation_id` text,
	`message_id` text,
	`note` text,
	`saved_at` text DEFAULT (CURRENT_TIMESTAMP),
	`conversation_id` text,
	`is_pinned` integer DEFAULT false,
	`is_unread` integer DEFAULT false,
	`snoozed_until` text,
	`snoozed_next_response_at` text,
	`revision` integer DEFAULT 1,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	`task_id` text,
	`task_version` integer,
	`read_at` text,
	`dismissed_at` text,
	`teammate_id` text,
	`publication_id` text,
	`feedback_conversation_id` text,
	`rating` integer,
	`verdict` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`feedback_teammate_id` text GENERATED ALWAYS AS (CASE WHEN resource_type = 'teammate_feedback' THEN teammate_id END) VIRTUAL,
	`installed_teammate_id` text GENERATED ALWAYS AS (CASE WHEN resource_type = 'teammate_install' THEN teammate_id END) VIRTUAL,
	`teammate_user_id` integer GENERATED ALWAYS AS (CASE WHEN resource_type IN ('teammate_install', 'teammate_rating', 'teammate_feedback') THEN user_id END) VIRTUAL,
	`resource_type` text NOT NULL,
	`state_user_id` integer GENERATED ALWAYS AS (CASE WHEN resource_type IN ('conversation', 'task') THEN user_id END) VIRTUAL,
	`saved_user_id` integer GENERATED ALWAYS AS (CASE WHEN resource_type = 'message' THEN user_id END) VIRTUAL,
	PRIMARY KEY(`resource_type`, `id`),
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`publication_id`) REFERENCES `template`(`publication_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`feedback_teammate_id`) REFERENCES `teammates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`installed_teammate_id`) REFERENCES `teammates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teammate_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`state_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`saved_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "user_resource_state_required_fields" CHECK((resource_type = 'message' AND id IS NOT NULL AND user_id IS NOT NULL AND saved_conversation_id IS NOT NULL AND message_id IS NOT NULL AND saved_at IS NOT NULL) OR (resource_type = 'conversation' AND conversation_id IS NOT NULL AND user_id IS NOT NULL AND is_pinned IS NOT NULL AND is_unread IS NOT NULL AND revision IS NOT NULL) OR (resource_type = 'task' AND user_id IS NOT NULL AND task_id IS NOT NULL AND task_version IS NOT NULL) OR (resource_type = 'teammate_install' AND teammate_id IS NOT NULL AND publication_id IS NOT NULL AND created_at IS NOT NULL AND rating IS NULL AND verdict IS NULL AND feedback_conversation_id IS NULL) OR (resource_type = 'teammate_rating' AND publication_id IS NOT NULL AND rating IS NOT NULL AND created_at IS NOT NULL AND teammate_id IS NULL AND verdict IS NULL AND feedback_conversation_id IS NULL) OR (resource_type = 'teammate_feedback' AND teammate_id IS NOT NULL AND verdict IS NOT NULL AND created_at IS NOT NULL AND publication_id IS NULL AND rating IS NULL)),
	CONSTRAINT "user_resource_state_shape_0" CHECK((((resource_type = 'conversation' AND conversation_id IS NOT NULL AND message_id IS NULL AND task_id IS NULL) OR (resource_type = 'message' AND message_id IS NOT NULL AND saved_conversation_id IS NOT NULL AND conversation_id IS NULL AND task_id IS NULL) OR (resource_type = 'task' AND task_id IS NOT NULL AND task_version IS NOT NULL AND conversation_id IS NULL AND message_id IS NULL)) AND teammate_id IS NULL AND publication_id IS NULL AND rating IS NULL AND verdict IS NULL AND feedback_conversation_id IS NULL) OR (((resource_type = 'teammate_install' AND teammate_id IS NOT NULL AND publication_id IS NOT NULL AND created_at IS NOT NULL AND rating IS NULL AND verdict IS NULL AND feedback_conversation_id IS NULL) OR (resource_type = 'teammate_rating' AND publication_id IS NOT NULL AND rating IS NOT NULL AND created_at IS NOT NULL AND teammate_id IS NULL AND verdict IS NULL AND feedback_conversation_id IS NULL) OR (resource_type = 'teammate_feedback' AND teammate_id IS NOT NULL AND verdict IS NOT NULL AND created_at IS NOT NULL AND publication_id IS NULL AND rating IS NULL)) AND conversation_id IS NULL AND message_id IS NULL AND saved_conversation_id IS NULL AND task_id IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_resource_state_saved_message_idx` ON `user_resource_state` (`user_id`,`message_id`) WHERE message_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `user_resource_state_conversation_user_idx` ON `user_resource_state` (`conversation_id`,`user_id`) WHERE conversation_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `user_resource_state_task_receipt_idx` ON `user_resource_state` (`user_id`,`task_id`,`task_version`) WHERE task_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX `user_resource_state_saved_at_idx` ON `user_resource_state` (`resource_type`,`user_id`,`saved_at`) WHERE resource_type = 'message';--> statement-breakpoint
CREATE INDEX `user_resource_state_pinned_idx` ON `user_resource_state` (`resource_type`,`user_id`,`is_pinned`) WHERE resource_type = 'conversation';--> statement-breakpoint
CREATE INDEX `user_resource_state_unread_idx` ON `user_resource_state` (`resource_type`,`user_id`,`is_unread`) WHERE resource_type = 'conversation';--> statement-breakpoint
CREATE INDEX `user_resource_state_snooze_idx` ON `user_resource_state` (`resource_type`,`user_id`,`snoozed_until`) WHERE resource_type = 'conversation';--> statement-breakpoint
CREATE INDEX `user_resource_state_task_version_idx` ON `user_resource_state` (`task_id`,`task_version`) WHERE task_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX `user_resource_state_state_owner_idx` ON `user_resource_state` (`state_user_id`) WHERE state_user_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX `user_resource_state_saved_owner_idx` ON `user_resource_state` (`saved_user_id`) WHERE saved_user_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX `user_resource_state_publication_user_idx` ON `user_resource_state` (`resource_type`,`publication_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `user_resource_state_publication_recent_idx` ON `user_resource_state` (`resource_type`,`publication_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `user_resource_state_teammate_idx` ON `user_resource_state` (`resource_type`,`teammate_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_resource_state_feedback_conversation_idx` ON `user_resource_state` (`user_id`,`teammate_id`,`feedback_conversation_id`) WHERE resource_type = 'teammate_feedback';--> statement-breakpoint
CREATE INDEX `user_resource_state_feedback_owner_idx` ON `user_resource_state` (`feedback_teammate_id`);--> statement-breakpoint
CREATE INDEX `user_resource_state_installed_owner_idx` ON `user_resource_state` (`installed_teammate_id`);--> statement-breakpoint
CREATE INDEX `user_resource_state_teammate_user_idx` ON `user_resource_state` (`teammate_user_id`);--> statement-breakpoint
CREATE INDEX `user_resource_state_publication_owner_idx` ON `user_resource_state` (`publication_id`);--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`model_permissions` text,
	`model_permissions_updated_by` integer,
	`description` text DEFAULT '' NOT NULL,
	`colour` text DEFAULT '#E8643C' NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`model_permissions_updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `workspace_created_by_idx` ON `workspace` (`created_by`);--> statement-breakpoint
CREATE TABLE `workspace_audit_record` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`actor_user_id` integer,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `workspace_audit_record_workspace_id_idx` ON `workspace_audit_record` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `workspace_audit_record_actor_user_id_idx` ON `workspace_audit_record` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `workspace_audit_record_created_at_idx` ON `workspace_audit_record` (`created_at`);
--> statement-breakpoint
CREATE VIEW search_fts_content AS SELECT rowid, title, content FROM search_chunk WHERE document_type = 'source';
--> statement-breakpoint
CREATE VIRTUAL TABLE search_fts USING fts5(title, content, content='search_fts_content', content_rowid='rowid', tokenize='unicode61');
--> statement-breakpoint
CREATE TRIGGER channel_sender_identity_immutable BEFORE UPDATE ON channel_sender
WHEN NEW.id IS NOT OLD.id OR NEW.binding_id IS NOT OLD.binding_id OR NEW.sender_id IS NOT OLD.sender_id
  OR NEW.user_id IS NOT OLD.user_id OR NEW.created_at IS NOT OLD.created_at OR NEW.revision != OLD.revision + 1
BEGIN
  SELECT RAISE(ABORT, 'Channel sender identity is immutable');
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
CREATE TRIGGER search_chunk_delete AFTER DELETE ON search_chunk WHEN old.document_type = 'source' BEGIN
  INSERT INTO search_fts(search_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
END;
--> statement-breakpoint
CREATE TRIGGER search_chunk_insert AFTER INSERT ON search_chunk WHEN new.document_type = 'source' BEGIN
  INSERT INTO search_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
END;
--> statement-breakpoint
CREATE TRIGGER search_chunk_update AFTER UPDATE OF title, content ON search_chunk WHEN new.document_type = 'source' BEGIN
  INSERT INTO search_fts(search_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
  INSERT INTO search_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
END;
--> statement-breakpoint
CREATE TRIGGER source_connection_deleted BEFORE DELETE ON provider_connection BEGIN
  UPDATE resource SET status = 'archived' WHERE resource_type = 'source' AND connection_id = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER source_knowledge_sync_deleted BEFORE DELETE ON source_knowledge_sync BEGIN
  UPDATE resource SET status = 'archived' WHERE resource_type = 'source' AND json_extract(metadata, '$.syncId') = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER source_search_revision_delete AFTER DELETE ON resource WHEN old.resource_type = 'source' BEGIN
  UPDATE search_document SET status = 'stale' WHERE document_type = 'source' AND source_id = old.id;
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
CREATE TRIGGER source_task_snapshot_immutable
BEFORE UPDATE OF content, metadata, title, external_uri, provider, scope_type, scope_id ON resource
WHEN OLD.resource_type = 'source' AND (json_extract(OLD.metadata, '$.immutableSnapshot') = 1
  OR EXISTS (SELECT 1 FROM project_task_integration WHERE source_id = OLD.id))
BEGIN
  SELECT RAISE(ABORT, 'Task snapshots are immutable');
END;
--> statement-breakpoint
INSERT INTO plans (id, name, description, price, included_credits, grace_credits)
VALUES
  ('anonymous', 'Signed out', 'Demo allowance for visitors who have not signed in', 0, 20, 0),
  ('free', 'Free', 'Default plan for signed in accounts', 0, 100, 0),
  ('pro', 'Pro', 'Frontier models, generation, live voice, sandboxed runs and Work', 8, 500, 50);
--> statement-breakpoint
INSERT INTO user (id, name, email, role, plan_id)
VALUES (-1, 'Polychat Platform', 'platform-teammates@polychat.app', 'user', NULL);
