ALTER TABLE `workspace` ADD `mission` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `workspace` ADD `monthly_credit_cap_micros` integer;--> statement-breakpoint
ALTER TABLE `workspace` ADD `lead_teammate_id` text;--> statement-breakpoint
ALTER TABLE `workspace` ADD `setup_project_id` text;--> statement-breakpoint
ALTER TABLE `workspace` ADD `setup_task_id` text;--> statement-breakpoint
ALTER TABLE `workspace` ADD `setup_plan` text;--> statement-breakpoint
ALTER TABLE `project` ADD `task_prefix` text;--> statement-breakpoint
ALTER TABLE `project` ADD `task_sequence` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `project` ADD `initiative_id` text;--> statement-breakpoint
ALTER TABLE `project` ADD `standup` text;--> statement-breakpoint
ALTER TABLE `project` ADD `standup_last_run_at` text;--> statement-breakpoint
ALTER TABLE `project_task` ADD `number` integer;--> statement-breakpoint
ALTER TABLE `project_task` ADD `key` text;--> statement-breakpoint
ALTER TABLE `project_task` ADD `kind` text DEFAULT 'task' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_task` ADD `description` text;--> statement-breakpoint
ALTER TABLE `project_task` ADD `priority` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_task` ADD `parent_task_id` text;--> statement-breakpoint
ALTER TABLE `project_task` ADD `start_at` text;--> statement-breakpoint
ALTER TABLE `project_task` ADD `due_at` text;--> statement-breakpoint
ALTER TABLE `project_task` ADD `reviewer` text;--> statement-breakpoint
ALTER TABLE `project_task` ADD `details` text;--> statement-breakpoint
CREATE INDEX `project_task_parent_idx` ON `project_task` (`parent_task_id`);--> statement-breakpoint
CREATE TABLE `project_task_link` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`from_task_id` text NOT NULL,
	`to_task_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_task_id`) REFERENCES `project_task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_task_id`) REFERENCES `project_task`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `project_task_link_pair_idx` ON `project_task_link` (`from_task_id`,`to_task_id`,`kind`);--> statement-breakpoint
CREATE INDEX `project_task_link_to_idx` ON `project_task_link` (`to_task_id`);--> statement-breakpoint
CREATE TABLE `initiative` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`target_date` text,
	`owner_teammate_id` text,
	`position` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `initiative_workspace_idx` ON `initiative` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `workspace_teammate` (
	`workspace_id` text NOT NULL,
	`teammate_id` text NOT NULL,
	`title` text NOT NULL,
	`reports_to_teammate_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`paused_reason` text,
	`responsible_user_id` integer NOT NULL,
	`heartbeat_minutes` integer,
	`last_heartbeat_at` text,
	`last_wake` text,
	`monthly_credit_cap_micros` integer,
	`budget_warned_period` text,
	`project_ids` text DEFAULT '[]' NOT NULL,
	`proposal` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY(`workspace_id`, `teammate_id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`teammate_id`) REFERENCES `teammates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`responsible_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX `workspace_teammate_teammate_idx` ON `workspace_teammate` (`teammate_id`);--> statement-breakpoint
INSERT INTO `project_task` (`id`, `project_id`, `workspace_id`, `objective`, `status`, `source`,
  `created_by_user_id`, `conversation_id`, `position`, `created_at`, `updated_at`, `completed_at`,
  `acceptance_criteria`, `assumptions`, `kill_conditions`, `depends_on_task_ids`, `require_approval_for`, `completions`)
SELECT lower(hex(randomblob(16))), c.`project_id`, p.`workspace_id`,
  COALESCE(NULLIF(trim(c.`title`), ''), 'Conversation'), 'done', 'user', c.`user_id`, c.`id`,
  -1000000 + ROW_NUMBER() OVER (PARTITION BY c.`project_id` ORDER BY c.`created_at`),
  c.`created_at`, COALESCE(c.`last_message_at`, c.`created_at`), COALESCE(c.`last_message_at`, c.`created_at`),
  '[]', '[]', '[]', '[]', '[]', '[]'
FROM `conversation` c
JOIN `project` p ON p.`id` = c.`project_id`
WHERE c.`project_id` IS NOT NULL
  AND c.`type` = 'chat'
  AND NOT EXISTS (SELECT 1 FROM `project_task` t WHERE t.`conversation_id` = c.`id`)
  AND NOT EXISTS (SELECT 1 FROM `teammate_context` tc WHERE tc.`home_conversation_id` = c.`id`)
  AND NOT EXISTS (SELECT 1 FROM `teammate_group_member` gm WHERE gm.`conversation_id` = c.`id`);--> statement-breakpoint
UPDATE `project_task` SET `number` = (
  SELECT ranked.`n` FROM (
    SELECT t.`id` AS `id`, ROW_NUMBER() OVER (PARTITION BY t.`project_id` ORDER BY t.`created_at`, t.`id`) AS `n`
    FROM `project_task` t
  ) ranked WHERE ranked.`id` = `project_task`.`id`
);--> statement-breakpoint
CREATE UNIQUE INDEX `project_task_number_idx` ON `project_task` (`project_id`,`number`) WHERE "project_task"."number" IS NOT NULL;--> statement-breakpoint
UPDATE `project` SET
  `task_sequence` = COALESCE((SELECT MAX(t.`number`) FROM `project_task` t WHERE t.`project_id` = `project`.`id`), 0),
  `task_prefix` = upper(substr(replace(replace(replace(`name`, ' ', ''), '-', ''), '_', ''), 1, 3));--> statement-breakpoint
UPDATE `project` SET `task_prefix` = 'TSK' WHERE `task_prefix` IS NULL OR length(`task_prefix`) < 2;--> statement-breakpoint
UPDATE `project_task` SET `key` = (SELECT p.`task_prefix` FROM `project` p WHERE p.`id` = `project_task`.`project_id`) || '-' || `number` WHERE `number` IS NOT NULL;
