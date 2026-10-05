CREATE TABLE `__next_model_approval` (
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text,
	`version_id` text,
	`route_id` text,
	`route_kind` text DEFAULT 'route' NOT NULL,
	`state` text NOT NULL,
	`subject_type` text,
	`subject_id` text,
	`data` text NOT NULL,
	`requested_by` integer,
	`decided_by` integer,
	`decided_at` text,
	`expires_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`kind`, `id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`version_id`) REFERENCES `__next_model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`decided_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`route_kind`,`route_id`) REFERENCES `__next_model_configuration`(`kind`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "model_approval_route_kind_check" CHECK("__next_model_approval"."route_kind" = 'route'),
	CONSTRAINT "model_approval_shape_check" CHECK(("__next_model_approval"."kind" = 'decision' AND "__next_model_approval"."version_id" IS NOT NULL) OR ("__next_model_approval"."kind" = 'spend' AND "__next_model_approval"."subject_type" IS NOT NULL AND "__next_model_approval"."subject_type" IN ('training_run', 'deployment')))
);
--> statement-breakpoint
CREATE TABLE `__next_model_asset_version` (
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
	FOREIGN KEY (`asset_kind`,`asset_id`) REFERENCES `__next_model_configuration`(`kind`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "model_asset_version_asset_kind_check" CHECK("__next_model_asset_version"."asset_kind" = 'asset')
);
--> statement-breakpoint
CREATE TABLE `__next_model_configuration` (
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
	FOREIGN KEY (`version_id`) REFERENCES `__next_model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`route_kind`,`route_id`) REFERENCES `__next_model_configuration`(`kind`,`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`canary_route_kind`,`canary_route_id`) REFERENCES `__next_model_configuration`(`kind`,`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "model_configuration_alias_route_check" CHECK((("__next_model_configuration"."route_id" IS NULL AND "__next_model_configuration"."route_kind" IS NULL) OR ("__next_model_configuration"."route_id" IS NOT NULL AND "__next_model_configuration"."route_kind" IS NOT NULL AND "__next_model_configuration"."route_kind" = 'route')) AND (("__next_model_configuration"."canary_route_id" IS NULL AND "__next_model_configuration"."canary_route_kind" IS NULL) OR ("__next_model_configuration"."canary_route_id" IS NOT NULL AND "__next_model_configuration"."canary_route_kind" IS NOT NULL AND "__next_model_configuration"."canary_route_kind" = 'route'))),
	CONSTRAINT "model_configuration_shape_check" CHECK(("__next_model_configuration"."kind" IN ('policy', 'budget')) OR ("__next_model_configuration"."kind" IN ('suite', 'grader') AND "__next_model_configuration"."name" IS NOT NULL) OR ("__next_model_configuration"."kind" = 'connection' AND "__next_model_configuration"."project_id" IS NULL AND "__next_model_configuration"."encrypted_secret" IS NOT NULL) OR ("__next_model_configuration"."kind" = 'asset' AND "__next_model_configuration"."asset_type" IS NOT NULL AND "__next_model_configuration"."source" IS NOT NULL AND "__next_model_configuration"."source_ref" IS NOT NULL AND "__next_model_configuration"."name" IS NOT NULL AND "__next_model_configuration"."version_id" IS NULL) OR ("__next_model_configuration"."kind" = 'route' AND "__next_model_configuration"."version_id" IS NOT NULL AND "__next_model_configuration"."provider" IS NOT NULL AND "__next_model_configuration"."provider_model_id" IS NOT NULL AND "__next_model_configuration"."status" IS NOT NULL) OR ("__next_model_configuration"."kind" = 'alias' AND "__next_model_configuration"."name" IS NOT NULL AND "__next_model_configuration"."version_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE `__next_model_operation` (
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
	FOREIGN KEY (`version_id`) REFERENCES `__next_model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`output_version_id`) REFERENCES `__next_model_asset_version`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`evaluation_route_kind`,`evaluation_route_id`) REFERENCES `__next_model_configuration`(`kind`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`suite_kind`,`suite_id`) REFERENCES `__next_model_configuration`(`kind`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "model_operation_evaluation_route_kind_check" CHECK("__next_model_operation"."evaluation_route_kind" = 'route'),
	CONSTRAINT "model_operation_suite_kind_check" CHECK("__next_model_operation"."suite_kind" = 'suite'),
	CONSTRAINT "model_operation_shape_check" CHECK(("__next_model_operation"."kind" = 'training' AND "__next_model_operation"."provider" IS NOT NULL) OR ("__next_model_operation"."kind" = 'evaluation' AND "__next_model_operation"."suite_id" IS NOT NULL AND "__next_model_operation"."evaluation_route_id" IS NOT NULL AND "__next_model_operation"."subject_version_id" IS NOT NULL AND "__next_model_operation"."trigger" IS NOT NULL) OR ("__next_model_operation"."kind" = 'deployment' AND "__next_model_operation"."name" IS NOT NULL AND "__next_model_operation"."version_id" IS NOT NULL AND "__next_model_operation"."provider" IS NOT NULL AND "__next_model_operation"."desired_state" IS NOT NULL) OR ("__next_model_operation"."kind" = 'upload' AND "__next_model_operation"."name" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE `__next_model_record` (
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
	FOREIGN KEY (`version_id`) REFERENCES `__next_model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`output_version_id`) REFERENCES `__next_model_asset_version`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`alias_kind`,`alias_id`) REFERENCES `__next_model_configuration`(`kind`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`configuration_kind`,`configuration_id`) REFERENCES `__next_model_configuration`(`kind`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`operation_kind`,`operation_id`) REFERENCES `__next_model_operation`(`kind`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "model_record_alias_kind_check" CHECK("__next_model_record"."alias_kind" = 'alias'),
	CONSTRAINT "model_record_parent_kind_check" CHECK("__next_model_record"."configuration_kind" = 'policy' AND "__next_model_record"."operation_kind" = 'training'),
	CONSTRAINT "model_record_shape_check" CHECK(("__next_model_record"."kind" = 'evidence' AND "__next_model_record"."version_id" IS NOT NULL AND "__next_model_record"."event_kind" IS NOT NULL AND "__next_model_record"."status" IS NOT NULL AND "__next_model_record"."source" IS NOT NULL AND "__next_model_record"."configuration_id" IS NULL AND "__next_model_record"."alias_id" IS NULL AND "__next_model_record"."operation_id" IS NULL) OR ("__next_model_record"."kind" = 'policy_revision' AND "__next_model_record"."configuration_id" IS NOT NULL AND "__next_model_record"."ordinal" IS NOT NULL AND "__next_model_record"."version_id" IS NULL AND "__next_model_record"."alias_id" IS NULL AND "__next_model_record"."operation_id" IS NULL) OR ("__next_model_record"."kind" = 'alias_event' AND "__next_model_record"."alias_id" IS NOT NULL AND "__next_model_record"."event_kind" IS NOT NULL AND "__next_model_record"."version_id" IS NULL AND "__next_model_record"."configuration_id" IS NULL AND "__next_model_record"."operation_id" IS NULL) OR ("__next_model_record"."kind" = 'checkpoint' AND "__next_model_record"."operation_id" IS NOT NULL AND "__next_model_record"."ordinal" IS NOT NULL AND "__next_model_record"."version_id" IS NULL AND "__next_model_record"."configuration_id" IS NULL AND "__next_model_record"."alias_id" IS NULL) OR ("__next_model_record"."kind" = 'file' AND "__next_model_record"."version_id" IS NOT NULL AND "__next_model_record"."path" IS NOT NULL AND "__next_model_record"."configuration_id" IS NULL AND "__next_model_record"."alias_id" IS NULL AND "__next_model_record"."operation_id" IS NULL) OR ("__next_model_record"."kind" = 'cost' AND "__next_model_record"."workspace_id" IS NOT NULL AND "__next_model_record"."subject_type" IS NOT NULL AND "__next_model_record"."subject_id" IS NOT NULL AND "__next_model_record"."provider" IS NOT NULL AND "__next_model_record"."usd" IS NOT NULL AND "__next_model_record"."period_start" IS NOT NULL AND "__next_model_record"."period_end" IS NOT NULL AND "__next_model_record"."version_id" IS NULL AND "__next_model_record"."configuration_id" IS NULL AND "__next_model_record"."alias_id" IS NULL AND "__next_model_record"."operation_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE `__next_resource_link` (
	`kind` text NOT NULL,
	`output_id` text,
	`collection_id` text,
	`source_id` text,
	`from_version_id` text,
	`to_version_id` text,
	`relation` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`output_id`) REFERENCES `output`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collection_id`) REFERENCES `resource_collection`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `source`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_version_id`) REFERENCES `__next_model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_version_id`) REFERENCES `__next_model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "resource_link_shape_check" CHECK(("__next_resource_link"."kind" = 'output_source' AND "__next_resource_link"."output_id" IS NOT NULL AND "__next_resource_link"."source_id" IS NOT NULL AND "__next_resource_link"."collection_id" IS NULL AND "__next_resource_link"."from_version_id" IS NULL AND "__next_resource_link"."to_version_id" IS NULL AND "__next_resource_link"."relation" IS NULL) OR ("__next_resource_link"."kind" = 'source_collection' AND "__next_resource_link"."collection_id" IS NOT NULL AND "__next_resource_link"."source_id" IS NOT NULL AND "__next_resource_link"."output_id" IS NULL AND "__next_resource_link"."from_version_id" IS NULL AND "__next_resource_link"."to_version_id" IS NULL AND "__next_resource_link"."relation" IS NULL) OR ("__next_resource_link"."kind" = 'model_lineage' AND "__next_resource_link"."from_version_id" IS NOT NULL AND "__next_resource_link"."to_version_id" IS NOT NULL AND "__next_resource_link"."relation" IS NOT NULL AND "__next_resource_link"."output_id" IS NULL AND "__next_resource_link"."collection_id" IS NULL AND "__next_resource_link"."source_id" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `__next_model_approval_workspace_idx` ON `__next_model_approval` (`kind`,`workspace_id`,`state`,`created_at`);
--> statement-breakpoint
CREATE INDEX `__next_model_approval_version_idx` ON `__next_model_approval` (`kind`,`version_id`,`route_id`);
--> statement-breakpoint
CREATE INDEX `__next_model_approval_expiration_idx` ON `__next_model_approval` (`kind`,`state`,`expires_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `__next_model_asset_version_revision_idx` ON `__next_model_asset_version` (`asset_id`,`revision`);
--> statement-breakpoint
CREATE INDEX `__next_model_asset_version_workspace_idx` ON `__next_model_asset_version` (`workspace_id`,`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `__next_model_configuration_scope_idx` ON `__next_model_configuration` (`workspace_id`,`kind`,`scope_key`) WHERE "__next_model_configuration"."kind" IN ('policy', 'budget', 'connection');
--> statement-breakpoint
CREATE UNIQUE INDEX `__next_model_configuration_asset_source_idx` ON `__next_model_configuration` (`workspace_id`,`asset_type`,`source`,`source_ref`) WHERE "__next_model_configuration"."kind" = 'asset';
--> statement-breakpoint
CREATE UNIQUE INDEX `__next_model_configuration_route_target_idx` ON `__next_model_configuration` (`workspace_id`,`version_id`,`provider`,`provider_model_id`) WHERE "__next_model_configuration"."kind" = 'route';
--> statement-breakpoint
CREATE INDEX `__next_model_configuration_route_provider_idx` ON `__next_model_configuration` (`kind`,`provider`,`provider_model_id`,`status`);
--> statement-breakpoint
CREATE INDEX `__next_model_configuration_route_version_idx` ON `__next_model_configuration` (`kind`,`workspace_id`,`version_id`,`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `__next_model_configuration_alias_name_idx` ON `__next_model_configuration` (`workspace_id`,`scope_key`,`name`) WHERE "__next_model_configuration"."kind" = 'alias';
--> statement-breakpoint
CREATE INDEX `__next_model_configuration_alias_route_idx` ON `__next_model_configuration` (`kind`,`route_id`);
--> statement-breakpoint
CREATE INDEX `__next_model_configuration_alias_canary_idx` ON `__next_model_configuration` (`kind`,`canary_route_id`);
--> statement-breakpoint
CREATE INDEX `__next_model_configuration_workspace_idx` ON `__next_model_configuration` (`workspace_id`,`kind`,`project_id`);
--> statement-breakpoint
CREATE INDEX `__next_model_operation_workspace_idx` ON `__next_model_operation` (`kind`,`workspace_id`,`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `__next_model_operation_active_idx` ON `__next_model_operation` (`kind`,`status`,`last_checked_at`);
--> statement-breakpoint
CREATE INDEX `__next_model_operation_suite_idx` ON `__next_model_operation` (`kind`,`suite_id`,`evaluation_route_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `__next_model_operation_route_idx` ON `__next_model_operation` (`kind`,`evaluation_route_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `__next_model_operation_completed_idx` ON `__next_model_operation` (`kind`,`suite_id`,`evaluation_route_id`,`status`,`completed_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `__next_model_operation_deployment_name_idx` ON `__next_model_operation` (`workspace_id`,`name`) WHERE "__next_model_operation"."kind" = 'deployment';
--> statement-breakpoint
CREATE UNIQUE INDEX `__next_model_record_file_path_idx` ON `__next_model_record` (`version_id`,`path`) WHERE "__next_model_record"."kind" = 'file';
--> statement-breakpoint
CREATE INDEX `__next_model_record_cost_period_idx` ON `__next_model_record` (`kind`,`workspace_id`,`period_start`);
--> statement-breakpoint
CREATE INDEX `__next_model_record_cost_subject_idx` ON `__next_model_record` (`kind`,`subject_type`,`subject_id`);
--> statement-breakpoint
CREATE INDEX `__next_model_record_evidence_idx` ON `__next_model_record` (`kind`,`version_id`,`event_kind`,`created_at`);
--> statement-breakpoint
CREATE INDEX `__next_model_record_alias_idx` ON `__next_model_record` (`kind`,`alias_id`,`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `__next_model_record_revision_idx` ON `__next_model_record` (`configuration_id`,`ordinal`);
--> statement-breakpoint
CREATE UNIQUE INDEX `__next_model_record_checkpoint_idx` ON `__next_model_record` (`operation_id`,`ordinal`);
--> statement-breakpoint
CREATE UNIQUE INDEX `__next_resource_link_output_source_idx` ON `__next_resource_link` (`output_id`,`source_id`) WHERE "__next_resource_link"."kind" = 'output_source';
--> statement-breakpoint
CREATE UNIQUE INDEX `__next_resource_link_collection_source_idx` ON `__next_resource_link` (`collection_id`,`source_id`) WHERE "__next_resource_link"."kind" = 'source_collection';
--> statement-breakpoint
CREATE UNIQUE INDEX `__next_resource_link_lineage_idx` ON `__next_resource_link` (`from_version_id`,`to_version_id`,`relation`) WHERE "__next_resource_link"."kind" = 'model_lineage';
--> statement-breakpoint
CREATE INDEX `__next_resource_link_source_idx` ON `__next_resource_link` (`kind`,`source_id`);
--> statement-breakpoint
CREATE INDEX `__next_resource_link_lineage_target_idx` ON `__next_resource_link` (`kind`,`to_version_id`);
--> statement-breakpoint
INSERT INTO "__next_model_configuration" ("id", "kind", "workspace_id", "project_id", "scope_key", "name", "revision", "encrypted_secret", "data", "created_by", "updated_by", "created_at", "updated_at") SELECT "id", "kind", "workspace_id", "project_id", "scope_key", "name", "revision", "encrypted_secret", "data", "created_by", "updated_by", "created_at", "updated_at" FROM "model_configuration" ORDER BY rowid;
--> statement-breakpoint
INSERT INTO "__next_model_configuration" ("kind", "id", "workspace_id", "asset_type", "source", "source_ref", "name", "created_by", "created_at", "scope_key", "data") SELECT 'asset', "id", "workspace_id", "kind", "source", "source_ref", "display_name", "created_by", "created_at", "id", json_object() FROM "model_asset" ORDER BY rowid;
--> statement-breakpoint
INSERT INTO "__next_model_asset_version" ("id", "asset_id", "workspace_id", "revision", "status", "attributes", "failure_reason", "created_by", "created_at", "updated_at", "dataset_profile") SELECT "id", "asset_id", "workspace_id", "revision", "status", "attributes", "failure_reason", "created_by", "created_at", "updated_at", "dataset_profile" FROM "model_asset_version" ORDER BY rowid;
--> statement-breakpoint
INSERT INTO "__next_model_configuration" ("kind", "id", "workspace_id", "version_id", "provider", "provider_model_id", "status", "created_by", "created_at", "scope_key", "data") SELECT 'route', "id", "workspace_id", "version_id", "provider", "provider_model_id", "status", "created_by", "created_at", "id", json_object('region', "region", 'weights_verified', json(CASE WHEN "weights_verified" THEN 'true' ELSE 'false' END), 'deployment_id', "deployment_id", 'jurisdiction', "jurisdiction", 'retention', "retention") FROM "model_route" ORDER BY rowid;
--> statement-breakpoint
INSERT INTO "__next_model_configuration" ("kind", "route_kind", "canary_route_kind", "id", "workspace_id", "project_id", "scope_key", "name", "route_id", "canary_route_id", "updated_by", "updated_at", "created_at", "data") SELECT 'alias', CASE WHEN route_id IS NULL THEN NULL ELSE 'route' END, CASE WHEN canary_route_id IS NULL THEN NULL ELSE 'route' END, "id", "workspace_id", "project_id", "scope_key", "name", "route_id", "canary_route_id", "updated_by", "updated_at", "created_at", json_object('description', "description", 'canary_percent', "canary_percent", 'gate', json("gate"), 'requires_approval', json(CASE WHEN "requires_approval" THEN 'true' ELSE 'false' END)) FROM "model_alias" ORDER BY rowid;
--> statement-breakpoint
INSERT INTO "__next_model_operation" ("id", "kind", "workspace_id", "project_id", "status", "name", "provider", "provider_ref", "claim_started_at", "desired_state", "version_id", "output_version_id", "subject_version_id", "suite_id", "suite_kind", "route_id", "evaluation_route_id", "trigger", "billed_until", "data", "failure_reason", "created_by", "created_at", "updated_at", "started_at", "completed_at", "last_checked_at") SELECT "id", "kind", "workspace_id", "project_id", "status", "name", "provider", "provider_ref", "claim_started_at", "desired_state", "version_id", "output_version_id", "subject_version_id", "suite_id", "suite_kind", "route_id", "evaluation_route_id", "trigger", "billed_until", "data", "failure_reason", "created_by", "created_at", "updated_at", "started_at", "completed_at", "last_checked_at" FROM "model_operation" ORDER BY rowid;
--> statement-breakpoint
INSERT INTO "__next_model_record" ("id", "kind", "version_id", "route_id", "configuration_id", "configuration_kind", "alias_id", "operation_id", "operation_kind", "output_version_id", "event_kind", "ordinal", "status", "source", "data", "actor_user_id", "created_by", "created_at") SELECT "id", "kind", "version_id", "route_id", "configuration_id", "configuration_kind", "alias_id", "operation_id", "operation_kind", "output_version_id", "event_kind", "ordinal", "status", "source", "data", "actor_user_id", "created_by", "created_at" FROM "model_record" ORDER BY rowid;
--> statement-breakpoint
INSERT INTO "__next_model_record" ("kind", "id", "version_id", "path", "data") SELECT 'file', json_array(version_id, path), "version_id", "path", json_object('size', "size", 'sha256', "sha256", 'format', "format") FROM "model_asset_file" ORDER BY rowid;
--> statement-breakpoint
INSERT INTO "__next_model_record" ("kind", "id", "workspace_id", "project_id", "subject_type", "subject_id", "provider", "usd", "period_start", "period_end", "created_at", "data") SELECT 'cost', "id", "workspace_id", "project_id", "subject_type", "subject_id", "provider", "usd", "period_start", "period_end", "created_at", json_object('basis', "basis") FROM "model_cost_entry" ORDER BY rowid;
--> statement-breakpoint
INSERT INTO "__next_model_approval" ("id", "kind", "workspace_id", "project_id", "version_id", "route_id", "state", "subject_type", "subject_id", "data", "requested_by", "decided_by", "decided_at", "expires_at", "created_at") SELECT "id", "kind", "workspace_id", "project_id", "version_id", "route_id", "state", "subject_type", "subject_id", "data", "requested_by", "decided_by", "decided_at", "expires_at", "created_at" FROM "model_approval" ORDER BY rowid;
--> statement-breakpoint
INSERT INTO "__next_resource_link" ("kind", "output_id", "source_id", "created_at") SELECT 'output_source', "output_id", "source_id", "created_at" FROM "output_source" ORDER BY rowid;
--> statement-breakpoint
INSERT INTO "__next_resource_link" ("kind", "collection_id", "source_id", "created_at") SELECT 'source_collection', "collection_id", "source_id", "created_at" FROM "source_collection_member" ORDER BY rowid;
--> statement-breakpoint
INSERT INTO "__next_resource_link" ("kind", "from_version_id", "to_version_id", "relation", "created_at") SELECT 'model_lineage', "from_version_id", "to_version_id", "relation", "created_at" FROM "model_lineage_edge" ORDER BY rowid;
--> statement-breakpoint
CREATE TABLE "__model_resource_copy_check" ("valid" INTEGER NOT NULL CHECK ("valid" = 1));
--> statement-breakpoint
INSERT INTO "__model_resource_copy_check" SELECT (SELECT count(*) FROM "model_configuration") = (SELECT count(*) FROM "__next_model_configuration" WHERE kind NOT IN ('asset', 'route', 'alias'));
--> statement-breakpoint
INSERT INTO "__model_resource_copy_check" SELECT (SELECT count(*) FROM "model_record") = (SELECT count(*) FROM "__next_model_record" WHERE kind NOT IN ('file', 'cost'));
--> statement-breakpoint
INSERT INTO "__model_resource_copy_check" SELECT (SELECT count(*) FROM "model_asset") = (SELECT count(*) FROM "__next_model_configuration" WHERE kind = 'asset');
--> statement-breakpoint
INSERT INTO "__model_resource_copy_check" SELECT (SELECT count(*) FROM "model_route") = (SELECT count(*) FROM "__next_model_configuration" WHERE kind = 'route');
--> statement-breakpoint
INSERT INTO "__model_resource_copy_check" SELECT (SELECT count(*) FROM "model_alias") = (SELECT count(*) FROM "__next_model_configuration" WHERE kind = 'alias');
--> statement-breakpoint
INSERT INTO "__model_resource_copy_check" SELECT (SELECT count(*) FROM "model_asset_file") = (SELECT count(*) FROM "__next_model_record" WHERE kind = 'file');
--> statement-breakpoint
INSERT INTO "__model_resource_copy_check" SELECT (SELECT count(*) FROM "model_cost_entry") = (SELECT count(*) FROM "__next_model_record" WHERE kind = 'cost');
--> statement-breakpoint
INSERT INTO "__model_resource_copy_check" SELECT (SELECT count(*) FROM "model_asset_version") = (SELECT count(*) FROM "__next_model_asset_version" WHERE 1);
--> statement-breakpoint
INSERT INTO "__model_resource_copy_check" SELECT (SELECT count(*) FROM "model_operation") = (SELECT count(*) FROM "__next_model_operation" WHERE 1);
--> statement-breakpoint
INSERT INTO "__model_resource_copy_check" SELECT (SELECT count(*) FROM "model_approval") = (SELECT count(*) FROM "__next_model_approval" WHERE 1);
--> statement-breakpoint
INSERT INTO "__model_resource_copy_check" SELECT (SELECT count(*) FROM "output_source") = (SELECT count(*) FROM "__next_resource_link" WHERE kind = 'output_source');
--> statement-breakpoint
INSERT INTO "__model_resource_copy_check" SELECT (SELECT count(*) FROM "source_collection_member") = (SELECT count(*) FROM "__next_resource_link" WHERE kind = 'source_collection');
--> statement-breakpoint
INSERT INTO "__model_resource_copy_check" SELECT (SELECT count(*) FROM "model_lineage_edge") = (SELECT count(*) FROM "__next_resource_link" WHERE kind = 'model_lineage');
--> statement-breakpoint
DROP TABLE "__model_resource_copy_check";
--> statement-breakpoint
DROP TABLE "model_record";
--> statement-breakpoint
DROP TABLE "model_approval";
--> statement-breakpoint
DROP TABLE "model_operation";
--> statement-breakpoint
DROP TABLE "model_asset_file";
--> statement-breakpoint
DROP TABLE "model_lineage_edge";
--> statement-breakpoint
DROP TABLE "model_alias";
--> statement-breakpoint
DROP TABLE "model_route";
--> statement-breakpoint
DROP TABLE "model_asset_version";
--> statement-breakpoint
DROP TABLE "model_asset";
--> statement-breakpoint
DROP TABLE "model_configuration";
--> statement-breakpoint
DROP TABLE "model_cost_entry";
--> statement-breakpoint
DROP TABLE "output_source";
--> statement-breakpoint
DROP TABLE "source_collection_member";
--> statement-breakpoint
ALTER TABLE "__next_model_configuration" RENAME TO "model_configuration";
--> statement-breakpoint
ALTER TABLE "__next_model_asset_version" RENAME TO "model_asset_version";
--> statement-breakpoint
ALTER TABLE "__next_model_operation" RENAME TO "model_operation";
--> statement-breakpoint
ALTER TABLE "__next_model_record" RENAME TO "model_record";
--> statement-breakpoint
ALTER TABLE "__next_model_approval" RENAME TO "model_approval";
--> statement-breakpoint
ALTER TABLE "__next_resource_link" RENAME TO "resource_link";
--> statement-breakpoint
DROP INDEX "__next_model_approval_workspace_idx";
--> statement-breakpoint
CREATE INDEX `model_approval_workspace_idx` ON `model_approval` (`kind`,`workspace_id`,`state`,`created_at`);
--> statement-breakpoint
DROP INDEX "__next_model_approval_version_idx";
--> statement-breakpoint
CREATE INDEX `model_approval_version_idx` ON `model_approval` (`kind`,`version_id`,`route_id`);
--> statement-breakpoint
DROP INDEX "__next_model_approval_expiration_idx";
--> statement-breakpoint
CREATE INDEX `model_approval_expiration_idx` ON `model_approval` (`kind`,`state`,`expires_at`);
--> statement-breakpoint
DROP INDEX "__next_model_asset_version_revision_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX `model_asset_version_revision_idx` ON `model_asset_version` (`asset_id`,`revision`);
--> statement-breakpoint
DROP INDEX "__next_model_asset_version_workspace_idx";
--> statement-breakpoint
CREATE INDEX `model_asset_version_workspace_idx` ON `model_asset_version` (`workspace_id`,`created_at`);
--> statement-breakpoint
DROP INDEX "__next_model_configuration_scope_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX `model_configuration_scope_idx` ON `model_configuration` (`workspace_id`,`kind`,`scope_key`) WHERE "model_configuration"."kind" IN ('policy', 'budget', 'connection');
--> statement-breakpoint
DROP INDEX "__next_model_configuration_asset_source_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX `model_configuration_asset_source_idx` ON `model_configuration` (`workspace_id`,`asset_type`,`source`,`source_ref`) WHERE "model_configuration"."kind" = 'asset';
--> statement-breakpoint
DROP INDEX "__next_model_configuration_route_target_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX `model_configuration_route_target_idx` ON `model_configuration` (`workspace_id`,`version_id`,`provider`,`provider_model_id`) WHERE "model_configuration"."kind" = 'route';
--> statement-breakpoint
DROP INDEX "__next_model_configuration_route_provider_idx";
--> statement-breakpoint
CREATE INDEX `model_configuration_route_provider_idx` ON `model_configuration` (`kind`,`provider`,`provider_model_id`,`status`);
--> statement-breakpoint
DROP INDEX "__next_model_configuration_route_version_idx";
--> statement-breakpoint
CREATE INDEX `model_configuration_route_version_idx` ON `model_configuration` (`kind`,`workspace_id`,`version_id`,`status`);
--> statement-breakpoint
DROP INDEX "__next_model_configuration_alias_name_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX `model_configuration_alias_name_idx` ON `model_configuration` (`workspace_id`,`scope_key`,`name`) WHERE "model_configuration"."kind" = 'alias';
--> statement-breakpoint
DROP INDEX "__next_model_configuration_alias_route_idx";
--> statement-breakpoint
CREATE INDEX `model_configuration_alias_route_idx` ON `model_configuration` (`kind`,`route_id`);
--> statement-breakpoint
DROP INDEX "__next_model_configuration_alias_canary_idx";
--> statement-breakpoint
CREATE INDEX `model_configuration_alias_canary_idx` ON `model_configuration` (`kind`,`canary_route_id`);
--> statement-breakpoint
DROP INDEX "__next_model_configuration_workspace_idx";
--> statement-breakpoint
CREATE INDEX `model_configuration_workspace_idx` ON `model_configuration` (`workspace_id`,`kind`,`project_id`);
--> statement-breakpoint
DROP INDEX "__next_model_operation_workspace_idx";
--> statement-breakpoint
CREATE INDEX `model_operation_workspace_idx` ON `model_operation` (`kind`,`workspace_id`,`status`,`created_at`);
--> statement-breakpoint
DROP INDEX "__next_model_operation_active_idx";
--> statement-breakpoint
CREATE INDEX `model_operation_active_idx` ON `model_operation` (`kind`,`status`,`last_checked_at`);
--> statement-breakpoint
DROP INDEX "__next_model_operation_suite_idx";
--> statement-breakpoint
CREATE INDEX `model_operation_suite_idx` ON `model_operation` (`kind`,`suite_id`,`evaluation_route_id`,`created_at`);
--> statement-breakpoint
DROP INDEX "__next_model_operation_route_idx";
--> statement-breakpoint
CREATE INDEX `model_operation_route_idx` ON `model_operation` (`kind`,`evaluation_route_id`,`created_at`);
--> statement-breakpoint
DROP INDEX "__next_model_operation_completed_idx";
--> statement-breakpoint
CREATE INDEX `model_operation_completed_idx` ON `model_operation` (`kind`,`suite_id`,`evaluation_route_id`,`status`,`completed_at`);
--> statement-breakpoint
DROP INDEX "__next_model_operation_deployment_name_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX `model_operation_deployment_name_idx` ON `model_operation` (`workspace_id`,`name`) WHERE "model_operation"."kind" = 'deployment';
--> statement-breakpoint
DROP INDEX "__next_model_record_file_path_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX `model_record_file_path_idx` ON `model_record` (`version_id`,`path`) WHERE "model_record"."kind" = 'file';
--> statement-breakpoint
DROP INDEX "__next_model_record_cost_period_idx";
--> statement-breakpoint
CREATE INDEX `model_record_cost_period_idx` ON `model_record` (`kind`,`workspace_id`,`period_start`);
--> statement-breakpoint
DROP INDEX "__next_model_record_cost_subject_idx";
--> statement-breakpoint
CREATE INDEX `model_record_cost_subject_idx` ON `model_record` (`kind`,`subject_type`,`subject_id`);
--> statement-breakpoint
DROP INDEX "__next_model_record_evidence_idx";
--> statement-breakpoint
CREATE INDEX `model_record_evidence_idx` ON `model_record` (`kind`,`version_id`,`event_kind`,`created_at`);
--> statement-breakpoint
DROP INDEX "__next_model_record_alias_idx";
--> statement-breakpoint
CREATE INDEX `model_record_alias_idx` ON `model_record` (`kind`,`alias_id`,`created_at`);
--> statement-breakpoint
DROP INDEX "__next_model_record_revision_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX `model_record_revision_idx` ON `model_record` (`configuration_id`,`ordinal`);
--> statement-breakpoint
DROP INDEX "__next_model_record_checkpoint_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX `model_record_checkpoint_idx` ON `model_record` (`operation_id`,`ordinal`);
--> statement-breakpoint
DROP INDEX "__next_resource_link_output_source_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_link_output_source_idx` ON `resource_link` (`output_id`,`source_id`) WHERE "resource_link"."kind" = 'output_source';
--> statement-breakpoint
DROP INDEX "__next_resource_link_collection_source_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_link_collection_source_idx` ON `resource_link` (`collection_id`,`source_id`) WHERE "resource_link"."kind" = 'source_collection';
--> statement-breakpoint
DROP INDEX "__next_resource_link_lineage_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_link_lineage_idx` ON `resource_link` (`from_version_id`,`to_version_id`,`relation`) WHERE "resource_link"."kind" = 'model_lineage';
--> statement-breakpoint
DROP INDEX "__next_resource_link_source_idx";
--> statement-breakpoint
CREATE INDEX `resource_link_source_idx` ON `resource_link` (`kind`,`source_id`);
--> statement-breakpoint
DROP INDEX "__next_resource_link_lineage_target_idx";
--> statement-breakpoint
CREATE INDEX `resource_link_lineage_target_idx` ON `resource_link` (`kind`,`to_version_id`);
