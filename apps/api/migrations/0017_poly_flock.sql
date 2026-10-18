ALTER TABLE `channel_binding` ADD `reaction_level` text DEFAULT 'ack' NOT NULL;--> statement-breakpoint
CREATE TABLE `teammate_group_member` (
	`conversation_id` text NOT NULL,
	`teammate_id` text NOT NULL,
	`position` integer NOT NULL,
	`added_by` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`conversation_id`, `teammate_id`),
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`teammate_id`) REFERENCES `teammates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `teammate_group_member_teammate_idx` ON `teammate_group_member` (`teammate_id`);
