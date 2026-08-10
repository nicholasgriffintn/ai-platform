CREATE TABLE `project` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`colour` text DEFAULT '#2563EB' NOT NULL,
	`created_by` integer NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `project_workspace_id_idx` ON `project` (`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_workspace_name_idx` ON `project` (`workspace_id`,`name`);--> statement-breakpoint
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
CREATE INDEX `workspace_member_user_id_idx` ON `workspace_member` (`user_id`);--> statement-breakpoint
DROP TABLE `magic_link_nonce`;--> statement-breakpoint
DROP TABLE `webauthn_challenge`;--> statement-breakpoint
ALTER TABLE `app_data` ADD `project_id` text REFERENCES project(id);--> statement-breakpoint
CREATE INDEX `app_data_project_id_idx` ON `app_data` (`project_id`);--> statement-breakpoint
ALTER TABLE `conversation` ADD `project_id` text REFERENCES project(id);--> statement-breakpoint
CREATE INDEX `conversation_project_id_idx` ON `conversation` (`project_id`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `project_id` text REFERENCES project(id);--> statement-breakpoint
CREATE INDEX `tasks_project_id_idx` ON `tasks` (`project_id`);