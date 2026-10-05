CREATE TABLE `enterprise_identity_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`label` text NOT NULL,
	`issuer` text NOT NULL,
	`client_id` text NOT NULL,
	`encrypted_secret` text NOT NULL,
	`configuration` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enterprise_identity_connection_workspace_idx` ON `enterprise_identity_connection` (`workspace_id`);