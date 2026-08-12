PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_workspace_audit_record` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`actor_user_id` integer,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_workspace_audit_record`("id", "workspace_id", "actor_user_id", "action", "target_type", "target_id", "metadata", "created_at") SELECT "id", "workspace_id", "actor_user_id", "action", "target_type", "target_id", "metadata", "created_at" FROM `workspace_audit_record`;--> statement-breakpoint
DROP TABLE `workspace_audit_record`;--> statement-breakpoint
ALTER TABLE `__new_workspace_audit_record` RENAME TO `workspace_audit_record`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `workspace_audit_record_workspace_id_idx` ON `workspace_audit_record` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `workspace_audit_record_actor_user_id_idx` ON `workspace_audit_record` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `workspace_audit_record_created_at_idx` ON `workspace_audit_record` (`created_at`);