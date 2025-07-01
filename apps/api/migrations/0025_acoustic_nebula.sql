CREATE TABLE `agent_installs` (
	`id` text PRIMARY KEY NOT NULL,
	`shared_agent_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`agent_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`shared_agent_id`) REFERENCES `shared_agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `agent_installs_shared_agent_id_idx` ON `agent_installs` (`shared_agent_id`);--> statement-breakpoint
CREATE INDEX `agent_installs_user_id_idx` ON `agent_installs` (`user_id`);--> statement-breakpoint
CREATE INDEX `agent_installs_agent_id_idx` ON `agent_installs` (`agent_id`);--> statement-breakpoint
CREATE INDEX `agent_installs_unique_idx` ON `agent_installs` (`shared_agent_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `agent_ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`shared_agent_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`review` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`shared_agent_id`) REFERENCES `shared_agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `agent_ratings_shared_agent_id_idx` ON `agent_ratings` (`shared_agent_id`);--> statement-breakpoint
CREATE INDEX `agent_ratings_user_id_idx` ON `agent_ratings` (`user_id`);--> statement-breakpoint
CREATE INDEX `agent_ratings_rating_idx` ON `agent_ratings` (`rating`);--> statement-breakpoint
CREATE INDEX `agent_ratings_unique_idx` ON `agent_ratings` (`shared_agent_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `shared_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`avatar_url` text,
	`category` text,
	`tags` text,
	`is_featured` integer DEFAULT false,
	`is_public` integer DEFAULT true,
	`usage_count` integer DEFAULT 0,
	`rating_count` integer DEFAULT 0,
	`rating_average` text DEFAULT '0',
	`template_data` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `shared_agents_agent_id_idx` ON `shared_agents` (`agent_id`);--> statement-breakpoint
CREATE INDEX `shared_agents_user_id_idx` ON `shared_agents` (`user_id`);--> statement-breakpoint
CREATE INDEX `shared_agents_category_idx` ON `shared_agents` (`category`);--> statement-breakpoint
CREATE INDEX `shared_agents_featured_idx` ON `shared_agents` (`is_featured`);--> statement-breakpoint
CREATE INDEX `shared_agents_public_idx` ON `shared_agents` (`is_public`);--> statement-breakpoint
CREATE INDEX `shared_agents_usage_idx` ON `shared_agents` (`usage_count`);--> statement-breakpoint
CREATE INDEX `shared_agents_rating_idx` ON `shared_agents` (`rating_average`);--> statement-breakpoint
ALTER TABLE `user` ADD `role` text DEFAULT 'user';