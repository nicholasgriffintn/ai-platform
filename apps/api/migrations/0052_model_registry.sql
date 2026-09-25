CREATE TABLE `model_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`kind` text NOT NULL,
	`source` text NOT NULL,
	`source_ref` text NOT NULL,
	`display_name` text NOT NULL,
	`created_by` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_asset_source_idx` ON `model_asset` (`workspace_id`,`kind`,`source`,`source_ref`);
--> statement-breakpoint
CREATE TABLE `model_asset_version` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`revision` text NOT NULL,
	`status` text DEFAULT 'importing' NOT NULL,
	`attributes` text NOT NULL,
	`failure_reason` text,
	`created_by` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `model_asset`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_asset_version_revision_idx` ON `model_asset_version` (`asset_id`,`revision`);
--> statement-breakpoint
CREATE INDEX `model_asset_version_workspace_idx` ON `model_asset_version` (`workspace_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `model_asset_file` (
	`version_id` text NOT NULL,
	`path` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text,
	`format` text,
	PRIMARY KEY(`version_id`, `path`),
	FOREIGN KEY (`version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `model_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`route_id` text,
	`kind` text NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`summary` text NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`observed_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `model_evidence_version_kind_idx` ON `model_evidence` (`version_id`,`kind`,`observed_at`);
--> statement-breakpoint
CREATE TABLE `model_policy` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text,
	`scope_key` text NOT NULL,
	`rules` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`hash` text NOT NULL,
	`enforcement` text DEFAULT 'advisory' NOT NULL,
	`updated_by` integer,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_policy_scope_idx` ON `model_policy` (`workspace_id`,`scope_key`);
--> statement-breakpoint
CREATE TABLE `model_policy_revision` (
	`policy_id` text NOT NULL,
	`revision` integer NOT NULL,
	`hash` text NOT NULL,
	`rules` text NOT NULL,
	`enforcement` text NOT NULL,
	`created_by` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`policy_id`, `revision`),
	FOREIGN KEY (`policy_id`) REFERENCES `model_policy`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `model_route` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`version_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_model_id` text NOT NULL,
	`region` text NOT NULL,
	`weights_verified` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`deployment_ref` text,
	`created_by` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_route_target_idx` ON `model_route` (`workspace_id`,`version_id`,`provider`,`provider_model_id`);
--> statement-breakpoint
CREATE INDEX `model_route_provider_model_idx` ON `model_route` (`provider`,`provider_model_id`);
--> statement-breakpoint
CREATE TABLE `model_decision` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text,
	`version_id` text NOT NULL,
	`route_id` text,
	`state` text DEFAULT 'pending' NOT NULL,
	`verdict` text NOT NULL,
	`evidence_ids` text DEFAULT '[]' NOT NULL,
	`is_exception` integer DEFAULT false NOT NULL,
	`conditions` text,
	`note` text,
	`requested_by` integer,
	`decided_by` integer,
	`decided_at` text,
	`expires_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`route_id`) REFERENCES `model_route`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`decided_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `model_decision_workspace_state_idx` ON `model_decision` (`workspace_id`,`state`,`created_at`);
--> statement-breakpoint
CREATE INDEX `model_decision_version_idx` ON `model_decision` (`version_id`,`route_id`);
--> statement-breakpoint
CREATE TABLE `model_lineage_edge` (
	`from_version_id` text NOT NULL,
	`to_version_id` text NOT NULL,
	`relation` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`from_version_id`, `to_version_id`, `relation`),
	FOREIGN KEY (`from_version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `model_lineage_edge_to_idx` ON `model_lineage_edge` (`to_version_id`);
--> statement-breakpoint
CREATE TABLE `model_eval_suite` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text,
	`name` text NOT NULL,
	`description` text,
	`system_prompt` text,
	`cases` text NOT NULL,
	`scorers` text NOT NULL,
	`replay_sample_size` integer DEFAULT 50 NOT NULL,
	`created_by` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `model_eval_suite_workspace_idx` ON `model_eval_suite` (`workspace_id`,`project_id`);
--> statement-breakpoint
CREATE TABLE `model_eval_run` (
	`id` text PRIMARY KEY NOT NULL,
	`suite_id` text NOT NULL,
	`route_id` text NOT NULL,
	`version_id` text NOT NULL,
	`trigger` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`scores` text DEFAULT '{}' NOT NULL,
	`latency_p95_ms` integer,
	`cases_completed` integer DEFAULT 0 NOT NULL,
	`cases_total` integer NOT NULL,
	`failure_reason` text,
	`created_by` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`suite_id`) REFERENCES `model_eval_suite`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`route_id`) REFERENCES `model_route`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `model_eval_run_route_idx` ON `model_eval_run` (`route_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `model_eval_run_suite_idx` ON `model_eval_run` (`suite_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `model_build` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text,
	`version_id` text NOT NULL,
	`base_version_id` text NOT NULL,
	`dataset_version_id` text NOT NULL,
	`provider` text NOT NULL,
	`job_name` text NOT NULL,
	`recipe` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`failure_reason` text,
	`created_by` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`base_version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dataset_version_id`) REFERENCES `model_asset_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `model_build_workspace_status_idx` ON `model_build` (`workspace_id`,`status`,`created_at`);
