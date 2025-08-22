CREATE TABLE `memories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`text` text NOT NULL,
	`category` text NOT NULL,
	`conversation_id` text,
	`metadata` text,
	`vector_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `memories_user_id_idx` ON `memories` (`user_id`);--> statement-breakpoint
CREATE INDEX `memories_category_idx` ON `memories` (`category`);--> statement-breakpoint
CREATE INDEX `memories_conversation_id_idx` ON `memories` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `memories_vector_id_idx` ON `memories` (`vector_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_memory_group_members` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`memory_id` text NOT NULL,
	`similarity_score` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `memory_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`memory_id`) REFERENCES `memories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_memory_group_members`("id", "group_id", "memory_id", "similarity_score", "created_at") SELECT "id", "group_id", "memory_id", "similarity_score", "created_at" FROM `memory_group_members`;--> statement-breakpoint
DROP TABLE `memory_group_members`;--> statement-breakpoint
ALTER TABLE `__new_memory_group_members` RENAME TO `memory_group_members`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `memory_group_members_group_id_idx` ON `memory_group_members` (`group_id`);--> statement-breakpoint
CREATE INDEX `memory_group_members_memory_id_idx` ON `memory_group_members` (`memory_id`);--> statement-breakpoint
CREATE INDEX `memory_group_members_unique_idx` ON `memory_group_members` (`group_id`,`memory_id`);