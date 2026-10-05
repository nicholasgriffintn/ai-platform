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
CREATE UNIQUE INDEX `provider_session_remote_identity_idx` ON `provider_session` (`remote_session_id`) WHERE session_type = 'connector';
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_session_browser_identity_idx` ON `provider_session` (`user_id`,`conversation_id`,`tool_call_id`) WHERE session_type = 'browser';
--> statement-breakpoint
CREATE INDEX `provider_session_conversation_idx` ON `provider_session` (`conversation_id`);
--> statement-breakpoint
CREATE INDEX `provider_session_expiry_idx` ON `provider_session` (`session_type`,`expires_at`);
--> statement-breakpoint
CREATE INDEX `provider_session_cleanup_idx` ON `provider_session` (`session_type`,`state`,`cleanup_after`);
--> statement-breakpoint
CREATE INDEX `provider_session_owner_provider_idx` ON `provider_session` (`session_type`,`user_id`,`provider`);
--> statement-breakpoint
CREATE INDEX `provider_session_run_idx` ON `provider_session` (`session_type`,`run_id`);
--> statement-breakpoint
CREATE INDEX `provider_session_context_idx` ON `provider_session` (`teammate_context_id`);
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
CREATE INDEX `approval_owner_state_idx` ON `approval` (`kind`,`user_id`,`state`);
--> statement-breakpoint
CREATE INDEX `approval_run_idx` ON `approval` (`kind`,`run_id`);
--> statement-breakpoint
CREATE INDEX `approval_workspace_idx` ON `approval` (`kind`,`workspace_id`,`state`,`created_at`);
--> statement-breakpoint
CREATE INDEX `approval_version_idx` ON `approval` (`kind`,`version_id`,`route_id`);
--> statement-breakpoint
CREATE INDEX `approval_expiration_idx` ON `approval` (`kind`,`state`,`expires_at`);
--> statement-breakpoint
CREATE TABLE `__next_event_subscription` (
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
CREATE UNIQUE INDEX `event_subscription_external_identity_idx` ON `__next_event_subscription` (`broker`,`external_trigger_id`);
--> statement-breakpoint
CREATE INDEX `event_subscription_installation_idx` ON `__next_event_subscription` (`installation_id`);
--> statement-breakpoint
CREATE INDEX `event_subscription_owner_idx` ON `__next_event_subscription` (`created_by_user_id`);
--> statement-breakpoint
CREATE INDEX `event_subscription_account_idx` ON `__next_event_subscription` (`connected_account_id`);
--> statement-breakpoint
CREATE TABLE `__next_delivery` (
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
	FOREIGN KEY (`trigger_id`) REFERENCES `__next_event_subscription`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`endpoint_platform`,`endpoint_id`) REFERENCES `notification_endpoint`(`platform`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "delivery_required_fields" CHECK((delivery_type = 'mobile' AND id IS NOT NULL AND device_id IS NOT NULL AND status IS NOT NULL AND created_at IS NOT NULL) OR (delivery_type = 'task' AND id IS NOT NULL AND dedupe_key IS NOT NULL AND registration_id IS NOT NULL AND user_id IS NOT NULL AND task_id IS NOT NULL AND task_version IS NOT NULL AND category IS NOT NULL AND status IS NOT NULL AND attempts IS NOT NULL AND created_at IS NOT NULL) OR (delivery_type = 'outbound' AND id IS NOT NULL AND user_id IS NOT NULL AND kind IS NOT NULL AND scope_id IS NOT NULL AND operation_id IS NOT NULL AND payload_digest IS NOT NULL AND payload_json IS NOT NULL AND state IS NOT NULL AND created_at IS NOT NULL AND updated_at IS NOT NULL) OR (delivery_type = 'recipe_event' AND trigger_id IS NOT NULL AND event_id IS NOT NULL AND state IS NOT NULL AND created_at IS NOT NULL)),
	CONSTRAINT "delivery_shape_0" CHECK((delivery_type = 'mobile' AND device_id IS NOT NULL AND registration_id IS NULL AND operation_id IS NULL AND status IN ('sending','sent','failed')) OR (delivery_type = 'task' AND registration_id IS NOT NULL AND device_id IS NULL AND operation_id IS NULL AND user_id IS NOT NULL AND task_id IS NOT NULL AND task_version IS NOT NULL AND dedupe_key IS NOT NULL AND category IN ('decisions','failures','completions','assignments') AND status IN ('pending','delivered','failed','obsolete')) OR (delivery_type = 'outbound' AND device_id IS NULL AND registration_id IS NULL AND user_id IS NOT NULL AND kind IS NOT NULL AND scope_id IS NOT NULL AND operation_id IS NOT NULL AND payload_digest IS NOT NULL AND payload_json IS NOT NULL AND state IN ('prepared','sending','sent','indeterminate')) OR (delivery_type = 'recipe_event' AND trigger_id IS NOT NULL AND event_id IS NOT NULL AND state IN ('evaluating','skipped','queued') AND device_id IS NULL AND registration_id IS NULL AND task_id IS NULL AND operation_id IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `__next_delivery_recipe_event_idx` ON `__next_delivery` (`trigger_id`,`event_id`) WHERE delivery_type = 'recipe_event';
--> statement-breakpoint
CREATE INDEX `__next_delivery_recipe_lease_idx` ON `__next_delivery` (`delivery_type`,`state`,`execution_lease_expires_at`) WHERE delivery_type = 'recipe_event';
--> statement-breakpoint
CREATE UNIQUE INDEX `__next_delivery_dedupe_idx` ON `__next_delivery` (`dedupe_key`) WHERE delivery_type = 'task';
--> statement-breakpoint
CREATE UNIQUE INDEX `__next_delivery_outbound_operation_idx` ON `__next_delivery` (`kind`,`scope_id`,`operation_id`) WHERE delivery_type = 'outbound';
--> statement-breakpoint
CREATE INDEX `__next_delivery_endpoint_idx` ON `__next_delivery` (`endpoint_platform`,`endpoint_id`);
--> statement-breakpoint
CREATE INDEX `__next_delivery_due_idx` ON `__next_delivery` (`delivery_type`,`status`,`next_attempt_at`) WHERE delivery_type = 'task';
--> statement-breakpoint
CREATE INDEX `__next_delivery_task_version_idx` ON `__next_delivery` (`task_id`,`task_version`) WHERE task_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `__next_delivery_outbound_owner_state_idx` ON `__next_delivery` (`delivery_type`,`user_id`,`state`) WHERE delivery_type = 'outbound';
--> statement-breakpoint
CREATE TABLE __provider_copy_guard (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
INSERT INTO provider_session ("id", "user_id", "conversation_id", "workspace_id", "provider", "credential_source", "provider_session_id", "tool_call_id", "input_hash", "creation_claimed", "creation_started_at", "last_error", "model", "destroyed_at", "created_at", "session_type") SELECT "id", "user_id", "conversation_id", "workspace_id", "provider", "credential_source", "provider_session_id", "tool_call_id", "input_hash", "creation_claimed", "creation_started_at", "last_error", "model", "destroyed_at", "created_at", 'browser' FROM browser_session;
--> statement-breakpoint
INSERT INTO __provider_copy_guard SELECT CASE WHEN NOT EXISTS (SELECT "id", "user_id", "conversation_id", "workspace_id", "provider", "credential_source", "provider_session_id", "tool_call_id", "input_hash", "creation_claimed", "creation_started_at", "last_error", "model", "destroyed_at", "created_at" FROM browser_session EXCEPT SELECT "id", "user_id", "conversation_id", "workspace_id", "provider", "credential_source", "provider_session_id", "tool_call_id", "input_hash", "creation_claimed", "creation_started_at", "last_error", "model", "destroyed_at", "created_at" FROM provider_session WHERE session_type = 'browser') AND (SELECT count(*) FROM browser_session) = (SELECT count(*) FROM provider_session WHERE session_type = 'browser') THEN 1 ELSE 0 END;
--> statement-breakpoint
INSERT INTO provider_session ("id", "remote_session_id", "kind", "user_id", "provider", "toolkit_slug", "auth_config_id", "connected_account_id", "allowed_operation_ids", "run_id", "completion_id", "recipe_id", "installation_id", "state", "created_at", "expires_at", "claimed_at", "cleanup_attempts", "cleanup_after", "teammate_context_id", "project_id", "session_type") SELECT "id", "remote_session_id", "kind", "user_id", "provider", "toolkit_slug", "auth_config_id", "connected_account_id", "allowed_operation_ids", "run_id", "completion_id", "recipe_id", "installation_id", "state", "created_at", "expires_at", "claimed_at", "cleanup_attempts", "cleanup_after", "teammate_context_id", "project_id", 'connector' FROM composio_connector_session;
--> statement-breakpoint
INSERT INTO __provider_copy_guard SELECT CASE WHEN NOT EXISTS (SELECT "id", "remote_session_id", "kind", "user_id", "provider", "toolkit_slug", "auth_config_id", "connected_account_id", "allowed_operation_ids", "run_id", "completion_id", "recipe_id", "installation_id", "state", "created_at", "expires_at", "claimed_at", "cleanup_attempts", "cleanup_after", "teammate_context_id", "project_id" FROM composio_connector_session EXCEPT SELECT "id", "remote_session_id", "kind", "user_id", "provider", "toolkit_slug", "auth_config_id", "connected_account_id", "allowed_operation_ids", "run_id", "completion_id", "recipe_id", "installation_id", "state", "created_at", "expires_at", "claimed_at", "cleanup_attempts", "cleanup_after", "teammate_context_id", "project_id" FROM provider_session WHERE session_type = 'connector') AND (SELECT count(*) FROM composio_connector_session) = (SELECT count(*) FROM provider_session WHERE session_type = 'connector') THEN 1 ELSE 0 END;
--> statement-breakpoint
INSERT INTO approval ("id", "kind", "workspace_id", "project_id", "version_id", "route_id", "route_kind", "state", "subject_type", "subject_id", "data", "requested_by", "decided_by", "decided_at", "expires_at", "created_at") SELECT "id", "kind", "workspace_id", "project_id", "version_id", "route_id", "route_kind", "state", "subject_type", "subject_id", "data", "requested_by", "decided_by", "decided_at", "expires_at", "created_at" FROM model_approval;
--> statement-breakpoint
INSERT INTO __provider_copy_guard SELECT CASE WHEN NOT EXISTS (SELECT "id", "kind", "workspace_id", "project_id", "version_id", "route_id", "route_kind", "state", "subject_type", "subject_id", "data", "requested_by", "decided_by", "decided_at", "expires_at", "created_at" FROM model_approval EXCEPT SELECT "id", "kind", "workspace_id", "project_id", "version_id", "route_id", "route_kind", "state", "subject_type", "subject_id", "data", "requested_by", "decided_by", "decided_at", "expires_at", "created_at" FROM approval) AND (SELECT count(*) FROM model_approval) = (SELECT count(*) FROM approval) THEN 1 ELSE 0 END;
--> statement-breakpoint
INSERT INTO approval ("id", "user_id", "run_id", "completion_id", "provider", "operation", "connected_account_id", "channel", "argument_digest", "state", "created_at", "expires_at", "resolved_at", "consumed_at", "authority_revision", "arguments_json", "recipe_id", "installation_id", "project_id", "teammate_context_id", "run_attempt", "execution_state", "execution_token", "execution_lease_expires_at", "execution_result_json", "kind") SELECT "id", "user_id", "run_id", "completion_id", "provider", "operation", "connected_account_id", "channel", "argument_digest", "state", "created_at", "expires_at", "resolved_at", "consumed_at", "authority_revision", "arguments_json", "recipe_id", "installation_id", "project_id", "teammate_context_id", "run_attempt", "execution_state", "execution_token", "execution_lease_expires_at", "execution_result_json", 'connector' FROM connector_operation_approval;
--> statement-breakpoint
INSERT INTO __provider_copy_guard SELECT CASE WHEN NOT EXISTS (SELECT "id", "user_id", "run_id", "completion_id", "provider", "operation", "connected_account_id", "channel", "argument_digest", "state", "created_at", "expires_at", "resolved_at", "consumed_at", "authority_revision", "arguments_json", "recipe_id", "installation_id", "project_id", "teammate_context_id", "run_attempt", "execution_state", "execution_token", "execution_lease_expires_at", "execution_result_json" FROM connector_operation_approval EXCEPT SELECT "id", "user_id", "run_id", "completion_id", "provider", "operation", "connected_account_id", "channel", "argument_digest", "state", "created_at", "expires_at", "resolved_at", "consumed_at", "authority_revision", "arguments_json", "recipe_id", "installation_id", "project_id", "teammate_context_id", "run_attempt", "execution_state", "execution_token", "execution_lease_expires_at", "execution_result_json" FROM approval WHERE kind = 'connector') AND (SELECT count(*) FROM connector_operation_approval) = (SELECT count(*) FROM approval WHERE kind = 'connector') THEN 1 ELSE 0 END;
--> statement-breakpoint
INSERT INTO __next_event_subscription ("id", "installation_id", "created_by_user_id", "project_id", "provider_id", "trigger_slug", "external_trigger_id", "connected_account_id", "external_user_id", "configuration", "status", "last_error", "created_at", "updated_at", "condition", "broker") SELECT "id", "installation_id", "created_by_user_id", "project_id", "provider_id", "trigger_slug", "external_trigger_id", "connected_account_id", "external_user_id", "configuration", "status", "last_error", "created_at", "updated_at", "condition", 'composio' FROM recipe_composio_trigger;
--> statement-breakpoint
INSERT INTO __provider_copy_guard SELECT CASE WHEN NOT EXISTS (SELECT "id", "installation_id", "created_by_user_id", "project_id", "provider_id", "trigger_slug", "external_trigger_id", "connected_account_id", "external_user_id", "configuration", "status", "last_error", "created_at", "updated_at", "condition" FROM recipe_composio_trigger EXCEPT SELECT "id", "installation_id", "created_by_user_id", "project_id", "provider_id", "trigger_slug", "external_trigger_id", "connected_account_id", "external_user_id", "configuration", "status", "last_error", "created_at", "updated_at", "condition" FROM __next_event_subscription WHERE broker = 'composio') AND (SELECT count(*) FROM recipe_composio_trigger) = (SELECT count(*) FROM __next_event_subscription WHERE broker = 'composio') THEN 1 ELSE 0 END;
--> statement-breakpoint
INSERT INTO __next_delivery ("id", "device_id", "status", "error_code", "created_at", "updated_at", "user_id", "kind", "scope_id", "operation_id", "payload_digest", "payload_json", "state", "execution_token", "execution_lease_expires_at", "sent_at", "dedupe_key", "registration_id", "task_id", "task_version", "category", "attempts", "provider_message_id", "failure_code", "next_attempt_at", "delivery_type") SELECT "id", "device_id", "status", "error_code", "created_at", "updated_at", "user_id", "kind", "scope_id", "operation_id", "payload_digest", "payload_json", "state", "execution_token", "execution_lease_expires_at", "sent_at", "dedupe_key", "registration_id", "task_id", "task_version", "category", "attempts", "provider_message_id", "failure_code", "next_attempt_at", "delivery_type" FROM delivery;
--> statement-breakpoint
INSERT INTO __provider_copy_guard SELECT CASE WHEN NOT EXISTS (SELECT "id", "device_id", "status", "error_code", "created_at", "updated_at", "user_id", "kind", "scope_id", "operation_id", "payload_digest", "payload_json", "state", "execution_token", "execution_lease_expires_at", "sent_at", "dedupe_key", "registration_id", "task_id", "task_version", "category", "attempts", "provider_message_id", "failure_code", "next_attempt_at", "delivery_type" FROM delivery EXCEPT SELECT "id", "device_id", "status", "error_code", "created_at", "updated_at", "user_id", "kind", "scope_id", "operation_id", "payload_digest", "payload_json", "state", "execution_token", "execution_lease_expires_at", "sent_at", "dedupe_key", "registration_id", "task_id", "task_version", "category", "attempts", "provider_message_id", "failure_code", "next_attempt_at", "delivery_type" FROM __next_delivery) AND (SELECT count(*) FROM delivery) = (SELECT count(*) FROM __next_delivery) THEN 1 ELSE 0 END;
--> statement-breakpoint
INSERT INTO __next_delivery ("id", "trigger_id", "event_id", "state", "execution_token", "execution_lease_expires_at", "decision_receipt", "queued_task_id", "created_at", "updated_at", "delivery_type") SELECT "id", "trigger_id", "event_id", "state", "execution_token", "execution_lease_expires_at", "decision_receipt", "task_id", "created_at", "updated_at", 'recipe_event' FROM recipe_event_receipt;
--> statement-breakpoint
INSERT INTO __provider_copy_guard SELECT CASE WHEN NOT EXISTS (SELECT "id", "trigger_id", "event_id", "state", "execution_token", "execution_lease_expires_at", "decision_receipt", "task_id", "created_at", "updated_at" FROM recipe_event_receipt EXCEPT SELECT "id", "trigger_id", "event_id", "state", "execution_token", "execution_lease_expires_at", "decision_receipt", "queued_task_id", "created_at", "updated_at" FROM __next_delivery WHERE delivery_type = 'recipe_event') AND (SELECT count(*) FROM recipe_event_receipt) = (SELECT count(*) FROM __next_delivery WHERE delivery_type = 'recipe_event') THEN 1 ELSE 0 END;
--> statement-breakpoint
INSERT INTO __provider_copy_guard SELECT CASE WHEN NOT EXISTS (SELECT id, context_id, provider, provider_handle, checkpoint_reference, status, lease_kind, lease_owner_id, lease_expires_at, lease_fence, last_error, created_at, updated_at FROM teammate_computer EXCEPT SELECT computer_id, id, computer_provider, computer_provider_handle, computer_checkpoint_reference, computer_status, computer_lease_kind, computer_lease_owner_id, computer_lease_expires_at, computer_lease_fence, computer_last_error, computer_created_at, computer_updated_at FROM teammate_context WHERE computer_id IS NOT NULL) AND (SELECT count(*) FROM teammate_computer) = (SELECT count(*) FROM teammate_context WHERE computer_id IS NOT NULL) THEN 1 ELSE 0 END;
--> statement-breakpoint
DROP TABLE browser_session;
--> statement-breakpoint
DROP TABLE composio_connector_session;
--> statement-breakpoint
DROP TABLE model_approval;
--> statement-breakpoint
DROP TABLE connector_operation_approval;
--> statement-breakpoint
DROP TABLE recipe_event_receipt;
--> statement-breakpoint
DROP TABLE recipe_composio_trigger;
--> statement-breakpoint
DROP TABLE delivery;
--> statement-breakpoint
DROP TABLE teammate_computer;
--> statement-breakpoint
ALTER TABLE __next_event_subscription RENAME TO event_subscription;
--> statement-breakpoint
ALTER TABLE __next_delivery RENAME TO delivery;
--> statement-breakpoint
DROP INDEX `__next_delivery_recipe_event_idx`;
--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_recipe_event_idx` ON `delivery` (`trigger_id`,`event_id`) WHERE delivery_type = 'recipe_event';
--> statement-breakpoint
DROP INDEX `__next_delivery_recipe_lease_idx`;
--> statement-breakpoint
CREATE INDEX `delivery_recipe_lease_idx` ON `delivery` (`delivery_type`,`state`,`execution_lease_expires_at`) WHERE delivery_type = 'recipe_event';
--> statement-breakpoint
DROP INDEX `__next_delivery_dedupe_idx`;
--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_dedupe_idx` ON `delivery` (`dedupe_key`) WHERE delivery_type = 'task';
--> statement-breakpoint
DROP INDEX `__next_delivery_outbound_operation_idx`;
--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_outbound_operation_idx` ON `delivery` (`kind`,`scope_id`,`operation_id`) WHERE delivery_type = 'outbound';
--> statement-breakpoint
DROP INDEX `__next_delivery_endpoint_idx`;
--> statement-breakpoint
CREATE INDEX `delivery_endpoint_idx` ON `delivery` (`endpoint_platform`,`endpoint_id`);
--> statement-breakpoint
DROP INDEX `__next_delivery_due_idx`;
--> statement-breakpoint
CREATE INDEX `delivery_due_idx` ON `delivery` (`delivery_type`,`status`,`next_attempt_at`) WHERE delivery_type = 'task';
--> statement-breakpoint
DROP INDEX `__next_delivery_task_version_idx`;
--> statement-breakpoint
CREATE INDEX `delivery_task_version_idx` ON `delivery` (`task_id`,`task_version`) WHERE task_id IS NOT NULL;
--> statement-breakpoint
DROP INDEX `__next_delivery_outbound_owner_state_idx`;
--> statement-breakpoint
CREATE INDEX `delivery_outbound_owner_state_idx` ON `delivery` (`delivery_type`,`user_id`,`state`) WHERE delivery_type = 'outbound';
--> statement-breakpoint
DROP TABLE __provider_copy_guard;
