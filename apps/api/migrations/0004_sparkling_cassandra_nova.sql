CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`description` text,
	`price` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
ALTER TABLE `user` ADD `plan_id` text REFERENCES plans(id);