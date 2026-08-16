CREATE TABLE `capability_configuration` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_type` text DEFAULT 'user' NOT NULL,
	`scope_id` text NOT NULL,
	`capability_kind` text DEFAULT 'tool' NOT NULL,
	`capability_id` text NOT NULL,
	`configuration` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `capability_configuration_scope_capability_idx` ON `capability_configuration` (`scope_type`,`scope_id`,`capability_kind`,`capability_id`);