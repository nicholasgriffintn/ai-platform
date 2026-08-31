ALTER TABLE `agents` ADD `owner_scope_type` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `agents` ADD `owner_scope_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `agents` ADD `derived_from_agent_id` text;--> statement-breakpoint
CREATE INDEX `agents_owner_scope_idx` ON `agents` (`owner_scope_type`,`owner_scope_id`);