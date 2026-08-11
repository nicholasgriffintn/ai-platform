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
CREATE TABLE `provider_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`provider` text NOT NULL,
	`kind` text NOT NULL,
	`external_id` text,
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
CREATE TABLE `template` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`workspace_id` text,
	`kind` text NOT NULL,
	`capability_id` text,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`configuration` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `template_created_by_user_id_idx` ON `template` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `template_workspace_id_idx` ON `template` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `template_capability_id_idx` ON `template` (`capability_id`);--> statement-breakpoint
CREATE TABLE `workspace_audit_record` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`actor_user_id` integer,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `workspace_audit_record_workspace_id_idx` ON `workspace_audit_record` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `workspace_audit_record_actor_user_id_idx` ON `workspace_audit_record` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `workspace_audit_record_created_at_idx` ON `workspace_audit_record` (`created_at`);--> statement-breakpoint
DROP TABLE `app_data`;--> statement-breakpoint
DROP TABLE `memories`;--> statement-breakpoint
DROP TABLE `memory_group_members`;--> statement-breakpoint
DROP TABLE `memory_groups`;--> statement-breakpoint
DROP TABLE `stored_asset`;