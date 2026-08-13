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
CREATE INDEX `recipe_composio_trigger_account_idx` ON `recipe_composio_trigger` (`connected_account_id`);