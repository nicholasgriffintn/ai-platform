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
CREATE TABLE `agent_installs` (
	`id` text PRIMARY KEY NOT NULL,
	`shared_agent_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`agent_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`shared_agent_id`) REFERENCES `shared_agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `agent_installs_shared_agent_id_idx` ON `agent_installs` (`shared_agent_id`);--> statement-breakpoint
CREATE INDEX `agent_installs_user_id_idx` ON `agent_installs` (`user_id`);--> statement-breakpoint
CREATE INDEX `agent_installs_agent_id_idx` ON `agent_installs` (`agent_id`);--> statement-breakpoint
CREATE INDEX `agent_installs_unique_idx` ON `agent_installs` (`shared_agent_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `agent_ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`shared_agent_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`review` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`shared_agent_id`) REFERENCES `shared_agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `agent_ratings_shared_agent_id_idx` ON `agent_ratings` (`shared_agent_id`);--> statement-breakpoint
CREATE INDEX `agent_ratings_user_id_idx` ON `agent_ratings` (`user_id`);--> statement-breakpoint
CREATE INDEX `agent_ratings_rating_idx` ON `agent_ratings` (`rating`);--> statement-breakpoint
CREATE INDEX `agent_ratings_unique_idx` ON `agent_ratings` (`shared_agent_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
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
	`team_id` text,
	`team_role` text,
	`is_team_agent` integer DEFAULT false,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `agents_user_id_idx` ON `agents` (`user_id`);--> statement-breakpoint
CREATE INDEX `agents_team_id_idx` ON `agents` (`team_id`);--> statement-breakpoint
CREATE TABLE `anonymous_user` (
	`id` text PRIMARY KEY NOT NULL,
	`ip_address` text NOT NULL,
	`user_agent` text,
	`daily_message_count` integer DEFAULT 0,
	`daily_reset` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	`last_active_at` text,
	`captcha_verified` integer DEFAULT false
);
--> statement-breakpoint
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
CREATE TABLE `auth_challenge` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_challenge_expires_at_idx` ON `auth_challenge` (`expires_at`);--> statement-breakpoint
CREATE TABLE `capability_configuration` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_type` text DEFAULT 'user' NOT NULL,
	`scope_id` text NOT NULL,
	`capability_kind` text DEFAULT 'tool' NOT NULL,
	`capability_id` text NOT NULL,
	`configuration` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `capability_configuration_scope_capability_idx` ON `capability_configuration` (`scope_type`,`scope_id`,`capability_kind`,`capability_id`);--> statement-breakpoint
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
	`cleanup_after` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`installation_id`) REFERENCES `template`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `composio_connector_session_remote_session_id_unique` ON `composio_connector_session` (`remote_session_id`);--> statement-breakpoint
CREATE INDEX `composio_connector_session_state_expiry_idx` ON `composio_connector_session` (`state`,`expires_at`);--> statement-breakpoint
CREATE INDEX `composio_connector_session_state_cleanup_idx` ON `composio_connector_session` (`state`,`cleanup_after`);--> statement-breakpoint
CREATE INDEX `composio_connector_session_owner_provider_idx` ON `composio_connector_session` (`user_id`,`provider`);--> statement-breakpoint
CREATE INDEX `composio_connector_session_run_idx` ON `composio_connector_session` (`run_id`);--> statement-breakpoint
CREATE TABLE `connector_operation_approval` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`run_id` text NOT NULL,
	`completion_id` text NOT NULL,
	`provider` text NOT NULL,
	`operation` text NOT NULL,
	`connected_account_id` text NOT NULL,
	`channel` text NOT NULL,
	`argument_digest` text NOT NULL,
	`state` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`resolved_at` text,
	`consumed_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `connector_operation_approval_owner_state_idx` ON `connector_operation_approval` (`user_id`,`state`);--> statement-breakpoint
CREATE INDEX `connector_operation_approval_state_expiry_idx` ON `connector_operation_approval` (`state`,`expires_at`);--> statement-breakpoint
CREATE INDEX `connector_operation_approval_run_idx` ON `connector_operation_approval` (`run_id`);--> statement-breakpoint
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
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_share_id_unique` ON `conversation` (`share_id`);--> statement-breakpoint
CREATE INDEX `conversation_title_idx` ON `conversation` (`title`);--> statement-breakpoint
CREATE INDEX `conversation_archived_idx` ON `conversation` (`is_archived`);--> statement-breakpoint
CREATE INDEX `conversation_public_idx` ON `conversation` (`is_public`);--> statement-breakpoint
CREATE INDEX `conversation_share_id_idx` ON `conversation` (`share_id`);--> statement-breakpoint
CREATE INDEX `conversation_user_id_idx` ON `conversation` (`user_id`);--> statement-breakpoint
CREATE INDEX `conversation_type_idx` ON `conversation` (`type`);--> statement-breakpoint
CREATE INDEX `conversation_parent_conversation_id_idx` ON `conversation` (`parent_conversation_id`);--> statement-breakpoint
CREATE INDEX `conversation_parent_message_id_idx` ON `conversation` (`parent_message_id`);--> statement-breakpoint
CREATE INDEX `conversation_project_id_idx` ON `conversation` (`project_id`);--> statement-breakpoint
CREATE TABLE `embedding` (
	`id` text PRIMARY KEY NOT NULL,
	`metadata` text,
	`title` text,
	`content` text,
	`type` text,
	`namespace` text,
	`user_id` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `embedding_namespace_idx` ON `embedding` (`namespace`);--> statement-breakpoint
CREATE INDEX `embedding_user_id_idx` ON `embedding` (`user_id`);--> statement-breakpoint
CREATE INDEX `embedding_scope_lookup_idx` ON `embedding` (`id`,`type`,`namespace`,`user_id`);--> statement-breakpoint
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
CREATE TABLE `memory_syntheses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`synthesis_text` text NOT NULL,
	`synthesis_version` integer DEFAULT 1,
	`memory_ids` text,
	`memory_count` integer DEFAULT 0,
	`tokens_used` integer,
	`namespace` text DEFAULT 'global',
	`is_active` integer DEFAULT true,
	`superseded_by` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `memory_syntheses_user_id_idx` ON `memory_syntheses` (`user_id`);--> statement-breakpoint
CREATE INDEX `memory_syntheses_namespace_idx` ON `memory_syntheses` (`namespace`);--> statement-breakpoint
CREATE INDEX `memory_syntheses_is_active_idx` ON `memory_syntheses` (`is_active`);--> statement-breakpoint
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
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `message_conversation_id_idx` ON `message` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `message_archived_idx` ON `message` (`is_archived`);--> statement-breakpoint
CREATE INDEX `message_parent_message_id_idx` ON `message` (`parent_message_id`);--> statement-breakpoint
CREATE INDEX `message_role_idx` ON `message` (`role`);--> statement-breakpoint
CREATE TABLE `mobile_auth_exchange_code` (
	`jti` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `mobile_auth_exchange_code_expires_at_idx` ON `mobile_auth_exchange_code` (`expires_at`);--> statement-breakpoint
CREATE INDEX `mobile_auth_exchange_code_session_idx` ON `mobile_auth_exchange_code` (`session_id`);--> statement-breakpoint
CREATE TABLE `model_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`model_id` text DEFAULT 'default',
	`enabled` integer DEFAULT true,
	`api_key` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `model_settings_user_id_idx` ON `model_settings` (`user_id`);--> statement-breakpoint
CREATE INDEX `model_settings_model_id_idx` ON `model_settings` (`model_id`);--> statement-breakpoint
CREATE INDEX `model_settings_enabled_idx` ON `model_settings` (`enabled`);--> statement-breakpoint
CREATE TABLE `oauth_account` (
	`provider_id` text,
	`provider_user_id` text,
	`user_id` integer NOT NULL,
	PRIMARY KEY(`provider_id`, `provider_user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `oauth_state` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`code_verifier` text,
	`nonce` text,
	`redirect_uri` text,
	`context` text,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oauth_state_expires_at_idx` ON `oauth_state` (`expires_at`);--> statement-breakpoint
CREATE TABLE `output` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`project_id` text,
	`conversation_id` text,
	`parent_output_id` text,
	`capability_id` text NOT NULL,
	`group_id` text,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`sensitivity` text NOT NULL,
	`content` text DEFAULT '{}' NOT NULL,
	`storage_key` text,
	`mime_type` text,
	`filename` text,
	`byte_size` integer,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `output_storage_key_unique` ON `output` (`storage_key`);--> statement-breakpoint
CREATE INDEX `output_created_by_user_id_idx` ON `output` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `output_project_id_idx` ON `output` (`project_id`);--> statement-breakpoint
CREATE INDEX `output_conversation_id_idx` ON `output` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `output_parent_output_id_idx` ON `output` (`parent_output_id`);--> statement-breakpoint
CREATE INDEX `output_capability_id_idx` ON `output` (`capability_id`);--> statement-breakpoint
CREATE INDEX `output_group_id_idx` ON `output` (`group_id`);--> statement-breakpoint
CREATE INDEX `output_lookup_idx` ON `output` (`created_by_user_id`,`capability_id`,`group_id`,`kind`);--> statement-breakpoint
CREATE TABLE `output_revision` (
	`output_id` text NOT NULL,
	`revision` integer NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`sensitivity` text NOT NULL,
	`content` text NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`output_id`, `revision`),
	FOREIGN KEY (`output_id`) REFERENCES `output`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `output_share` (
	`id` text PRIMARY KEY NOT NULL,
	`output_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`permission` text DEFAULT 'view' NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`expires_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`output_id`) REFERENCES `output`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `output_share_token_hash_unique` ON `output_share` (`token_hash`);--> statement-breakpoint
CREATE INDEX `output_share_output_id_idx` ON `output_share` (`output_id`);--> statement-breakpoint
CREATE TABLE `output_source` (
	`output_id` text NOT NULL,
	`source_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`output_id`, `source_id`),
	FOREIGN KEY (`output_id`) REFERENCES `output`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `source`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `output_source_source_id_idx` ON `output_source` (`source_id`);--> statement-breakpoint
CREATE TABLE `passkey` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`credential_id` text NOT NULL,
	`public_key` text NOT NULL,
	`counter` integer NOT NULL,
	`device_type` text NOT NULL,
	`backed_up` integer NOT NULL,
	`transports` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `passkey_credential_id_unique` ON `passkey` (`credential_id`);--> statement-breakpoint
CREATE INDEX `passkey_user_id_idx` ON `passkey` (`user_id`);--> statement-breakpoint
CREATE INDEX `passkey_credential_id_idx` ON `passkey` (`credential_id`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`description` text,
	`price` integer,
	`stripe_price_id` text,
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
	`coding_enabled` integer DEFAULT false NOT NULL,
	`coding_installation_id` integer,
	`coding_repository` text,
	`coding_prompt_strategy` text DEFAULT 'auto' NOT NULL,
	`coding_should_commit` integer DEFAULT true NOT NULL,
	`coding_timeout_seconds` integer DEFAULT 900 NOT NULL,
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
CREATE TABLE `project_capability` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`capability_id` text NOT NULL,
	`configuration` text DEFAULT '{}' NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_capability_project_kind_id_idx` ON `project_capability` (`project_id`,`kind`,`capability_id`);--> statement-breakpoint
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
	`completed_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignee_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`runner_identity_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `project_task_project_status_idx` ON `project_task` (`project_id`,`status`,`position`);--> statement-breakpoint
CREATE INDEX `project_task_workspace_status_idx` ON `project_task` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `project_task_assignee_idx` ON `project_task` (`assignee_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_task_conversation_idx` ON `project_task` (`conversation_id`) WHERE "project_task"."conversation_id" IS NOT NULL;--> statement-breakpoint
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
CREATE TABLE `provider_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`api_key` text,
	`enabled` integer DEFAULT false,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `provider_settings_user_id_idx` ON `provider_settings` (`user_id`);--> statement-breakpoint
CREATE INDEX `provider_settings_provider_id_idx` ON `provider_settings` (`provider_id`);--> statement-breakpoint
CREATE TABLE `recipe_composio_trigger` (
	`id` text PRIMARY KEY NOT NULL,
	`installation_id` text NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`project_id` text,
	`provider_id` text NOT NULL,
	`trigger_slug` text NOT NULL,
	`external_trigger_id` text NOT NULL,
	`connected_account_id` text NOT NULL,
	`external_user_id` text NOT NULL,
	`configuration` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_error` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`installation_id`) REFERENCES `template`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_composio_trigger_external_trigger_id_unique` ON `recipe_composio_trigger` (`external_trigger_id`);--> statement-breakpoint
CREATE INDEX `recipe_composio_trigger_installation_idx` ON `recipe_composio_trigger` (`installation_id`);--> statement-breakpoint
CREATE INDEX `recipe_composio_trigger_owner_idx` ON `recipe_composio_trigger` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `recipe_composio_trigger_account_idx` ON `recipe_composio_trigger` (`connected_account_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	`jwt_token` text,
	`jwt_expires_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shared_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`avatar_url` text,
	`category` text,
	`tags` text,
	`is_featured` integer DEFAULT false,
	`is_public` integer DEFAULT true,
	`usage_count` integer DEFAULT 0,
	`rating_count` integer DEFAULT 0,
	`rating_average` text DEFAULT '0',
	`template_data` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `shared_agents_agent_id_idx` ON `shared_agents` (`agent_id`);--> statement-breakpoint
CREATE INDEX `shared_agents_user_id_idx` ON `shared_agents` (`user_id`);--> statement-breakpoint
CREATE INDEX `shared_agents_category_idx` ON `shared_agents` (`category`);--> statement-breakpoint
CREATE INDEX `shared_agents_featured_idx` ON `shared_agents` (`is_featured`);--> statement-breakpoint
CREATE INDEX `shared_agents_public_idx` ON `shared_agents` (`is_public`);--> statement-breakpoint
CREATE INDEX `shared_agents_usage_idx` ON `shared_agents` (`usage_count`);--> statement-breakpoint
CREATE INDEX `shared_agents_rating_idx` ON `shared_agents` (`rating_average`);--> statement-breakpoint
CREATE TABLE `source` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`project_id` text,
	`conversation_id` text,
	`connection_id` text,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`content` text,
	`provider` text,
	`external_uri` text,
	`vector_id` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`storage_key` text,
	`mime_type` text,
	`filename` text,
	`byte_size` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`connection_id`) REFERENCES `provider_connection`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_storage_key_unique` ON `source` (`storage_key`);--> statement-breakpoint
CREATE INDEX `source_created_by_user_id_idx` ON `source` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `source_project_id_idx` ON `source` (`project_id`);--> statement-breakpoint
CREATE INDEX `source_conversation_id_idx` ON `source` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `source_connection_id_idx` ON `source` (`connection_id`);--> statement-breakpoint
CREATE INDEX `source_kind_idx` ON `source` (`kind`);--> statement-breakpoint
CREATE INDEX `source_vector_id_idx` ON `source` (`vector_id`);--> statement-breakpoint
CREATE TABLE `source_collection` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`project_id` text,
	`title` text NOT NULL,
	`description` text,
	`kind` text DEFAULT 'general' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `source_collection_created_by_user_id_idx` ON `source_collection` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `source_collection_project_id_idx` ON `source_collection` (`project_id`);--> statement-breakpoint
CREATE TABLE `source_collection_member` (
	`collection_id` text NOT NULL,
	`source_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`collection_id`, `source_id`),
	FOREIGN KEY (`collection_id`) REFERENCES `source_collection`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `source`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `source_collection_member_source_id_idx` ON `source_collection_member` (`source_id`);--> statement-breakpoint
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
	`completed_at` text,
	`error_message` text,
	`metadata` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tasks_user_id_idx` ON `tasks` (`user_id`);--> statement-breakpoint
CREATE INDEX `tasks_project_id_idx` ON `tasks` (`project_id`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_task_type_idx` ON `tasks` (`task_type`);--> statement-breakpoint
CREATE INDEX `tasks_scheduled_at_idx` ON `tasks` (`scheduled_at`);--> statement-breakpoint
CREATE TABLE `template` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`workspace_id` text,
	`project_id` text,
	`kind` text NOT NULL,
	`capability_id` text,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`configuration` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `template_created_by_user_id_idx` ON `template` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `template_workspace_id_idx` ON `template` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `template_project_id_idx` ON `template` (`project_id`);--> statement-breakpoint
CREATE INDEX `template_capability_id_idx` ON `template` (`capability_id`);--> statement-breakpoint
CREATE TABLE `training_deployments` (
	`provider` text NOT NULL,
	`endpoint_name` text NOT NULL,
	`deployment_name` text NOT NULL,
	`model_name` text NOT NULL,
	`endpoint_config_name` text NOT NULL,
	`user_id` integer,
	`status` text NOT NULL,
	`model_id` text NOT NULL,
	`model_artifacts_s3_uri` text,
	`failure_reason` text,
	`request_json` text,
	`response_json` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY(`provider`, `endpoint_name`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `training_deployments_user_id_idx` ON `training_deployments` (`user_id`);--> statement-breakpoint
CREATE INDEX `training_deployments_status_idx` ON `training_deployments` (`status`);--> statement-breakpoint
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
CREATE TABLE `training_job_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`job_name` text NOT NULL,
	`level` text NOT NULL,
	`message` text NOT NULL,
	`metadata_json` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `training_job_events_job_idx` ON `training_job_events` (`provider`,`job_name`);--> statement-breakpoint
CREATE INDEX `training_job_events_created_at_idx` ON `training_job_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `training_jobs` (
	`provider` text NOT NULL,
	`job_name` text NOT NULL,
	`provider_job_id` text,
	`user_id` integer,
	`status` text NOT NULL,
	`model_id` text NOT NULL,
	`base_model` text NOT NULL,
	`training_image` text,
	`training_data_s3_uri` text,
	`validation_data_s3_uri` text,
	`output_s3_uri` text,
	`model_artifacts_s3_uri` text,
	`failure_reason` text,
	`request_json` text,
	`response_json` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY(`provider`, `job_name`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `training_jobs_user_id_idx` ON `training_jobs` (`user_id`);--> statement-breakpoint
CREATE INDEX `training_jobs_status_idx` ON `training_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `training_jobs_updated_at_idx` ON `training_jobs` (`updated_at`);--> statement-breakpoint
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
	`plan_id` text DEFAULT 'free',
	`message_count` integer DEFAULT 0,
	`daily_message_count` integer DEFAULT 0,
	`daily_reset` text,
	`daily_pro_message_count` integer DEFAULT 0,
	`daily_pro_reset` text,
	`byok_message_count` integer DEFAULT 0,
	`daily_byok_message_count` integer DEFAULT 0,
	`daily_byok_reset` text,
	`last_active_at` text,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `user_api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`api_key` text NOT NULL,
	`hashed_key` text NOT NULL,
	`name` text DEFAULT 'API Key',
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_api_keys_hashed_key_unique` ON `user_api_keys` (`hashed_key`);--> statement-breakpoint
CREATE INDEX `user_api_keys_user_id_idx` ON `user_api_keys` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_api_keys_hashed_key_idx` ON `user_api_keys` (`hashed_key`);--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`nickname` text,
	`job_role` text,
	`traits` text,
	`preferences` text,
	`guardrails_enabled` integer DEFAULT false,
	`guardrails_provider` text DEFAULT 'llamaguard',
	`bedrock_guardrail_id` text,
	`bedrock_guardrail_version` text,
	`embedding_provider` text DEFAULT 'vectorize',
	`bedrock_knowledge_base_id` text,
	`bedrock_knowledge_base_custom_data_source_id` text,
	`s3vectors_bucket_name` text,
	`s3vectors_index_name` text,
	`s3vectors_region` text,
	`memories_save_enabled` integer DEFAULT false,
	`memories_chat_history_enabled` integer DEFAULT false,
	`temporary_chats_default` integer DEFAULT false,
	`memory_provider` text DEFAULT 'built-in',
	`transcription_provider` text DEFAULT 'workers',
	`transcription_model` text DEFAULT 'whisper',
	`speech_provider` text DEFAULT 'melotts',
	`speech_model` text DEFAULT '@cf/myshell-ai/melotts',
	`search_provider` text,
	`sandbox_model` text,
	`tracking_enabled` integer DEFAULT true,
	`public_key` text,
	`private_key` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_settings_user_id_idx` ON `user_settings` (`user_id`);--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`colour` text DEFAULT '#E8643C' NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
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
CREATE INDEX `workspace_audit_record_created_at_idx` ON `workspace_audit_record` (`created_at`);--> statement-breakpoint
CREATE TABLE `workspace_invitation` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`token_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`invited_by` integer NOT NULL,
	`accepted_by` integer,
	`expires_at` text NOT NULL,
	`accepted_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`accepted_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_invitation_token_hash_unique` ON `workspace_invitation` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_invitation_workspace_email_idx` ON `workspace_invitation` (`workspace_id`,`email`);--> statement-breakpoint
CREATE INDEX `workspace_invitation_workspace_status_idx` ON `workspace_invitation` (`workspace_id`,`status`);--> statement-breakpoint
CREATE TABLE `workspace_member` (
	`workspace_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`role` text NOT NULL,
	`joined_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`workspace_id`, `user_id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workspace_member_user_id_idx` ON `workspace_member` (`user_id`);