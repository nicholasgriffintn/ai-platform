CREATE TABLE `project_environment_variable` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`encrypted_value` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_environment_variable_name_idx` ON `project_environment_variable` (`project_id`,`name`);--> statement-breakpoint
CREATE INDEX `project_environment_variable_project_idx` ON `project_environment_variable` (`project_id`);
