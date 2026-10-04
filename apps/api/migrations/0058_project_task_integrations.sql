CREATE TABLE `project_github_review_policy` (
	`project_id` text PRIMARY KEY NOT NULL,
	`owner_user_id` integer NOT NULL,
	`connection_id` text NOT NULL,
	`installation_id` integer NOT NULL,
	`repository` text NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`token_budget` integer NOT NULL,
	`revision` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `provider_connection`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
CREATE INDEX `project_github_review_policy_repository` ON `project_github_review_policy` (`installation_id`,`repository`,`enabled`);
--> statement-breakpoint
CREATE TABLE `project_pull_request_review` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`task_id` text NOT NULL,
	`source_id` text NOT NULL,
	`target` text NOT NULL,
	`policy_revision` text NOT NULL,
	`publication_status` text DEFAULT 'unpublished' NOT NULL,
	`publication_body` text,
	`publication_completion_id` text,
	`published_url` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `source`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "project_pull_request_review_publication_status" CHECK("project_pull_request_review"."publication_status" IN ('unpublished', 'publishing', 'published', 'unknown'))
);

--> statement-breakpoint
CREATE UNIQUE INDEX `project_pull_request_review_task_id_unique` ON `project_pull_request_review` (`task_id`);
--> statement-breakpoint
CREATE INDEX `project_pull_request_review_project` ON `project_pull_request_review` (`project_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `project_task_external_import` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`task_id` text NOT NULL,
	`source_id` text NOT NULL,
	`provider` text NOT NULL,
	`account_id` text NOT NULL,
	`external_id` text NOT NULL,
	`revision` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `source`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "project_task_external_import_provider" CHECK("project_task_external_import"."provider" IN ('github', 'linear'))
);

--> statement-breakpoint
CREATE UNIQUE INDEX `project_task_external_import_task_id_unique` ON `project_task_external_import` (`task_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_task_external_import_identity` ON `project_task_external_import` (`project_id`,`provider`,`account_id`,`external_id`);
--> statement-breakpoint
ALTER TABLE `project_task` ADD `execution_profile` text;
--> statement-breakpoint
CREATE TRIGGER source_task_snapshot_immutable
BEFORE UPDATE OF content, metadata, title, external_uri, provider, project_id ON source
WHEN json_extract(OLD.metadata, '$.immutableSnapshot') = 1
  OR EXISTS (SELECT 1 FROM project_task_external_import WHERE source_id = OLD.id)
  OR EXISTS (SELECT 1 FROM project_pull_request_review WHERE source_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'Task snapshots are immutable');
END;
