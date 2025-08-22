CREATE TABLE `memory_group_members` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`memory_id` text NOT NULL,
	`similarity_score` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `memory_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `memory_group_members_group_id_idx` ON `memory_group_members` (`group_id`);--> statement-breakpoint
CREATE INDEX `memory_group_members_memory_id_idx` ON `memory_group_members` (`memory_id`);--> statement-breakpoint
CREATE INDEX `memory_group_members_unique_idx` ON `memory_group_members` (`group_id`,`memory_id`);--> statement-breakpoint
CREATE TABLE `memory_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `memory_groups_user_id_idx` ON `memory_groups` (`user_id`);--> statement-breakpoint
CREATE INDEX `memory_groups_category_idx` ON `memory_groups` (`category`);