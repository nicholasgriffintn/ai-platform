CREATE TABLE `channel_binding` (
	`id` text PRIMARY KEY NOT NULL,
	`channel` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text NOT NULL,
	`external_id` text NOT NULL,
	`label` text,
	`teammate_id` text,
	`created_by` integer NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`teammate_id`) REFERENCES `teammates`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channel_binding_channel_external_idx` ON `channel_binding` (`channel`,`external_id`);--> statement-breakpoint
CREATE INDEX `channel_binding_scope_idx` ON `channel_binding` (`scope_type`,`scope_id`);
