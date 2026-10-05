CREATE TABLE `native_mcp_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`server_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`encrypted_credential` text NOT NULL,
	`shared_projects` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`server_id`) REFERENCES `native_mcp_server`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `native_mcp_connection_owner_server_idx` ON `native_mcp_connection` (`user_id`,`server_id`);--> statement-breakpoint
CREATE TABLE `native_mcp_server` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`workspace_id` text,
	`label` text NOT NULL,
	`endpoint` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`tools` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `teammates` ADD `retired_mcp_servers` text;
--> statement-breakpoint
CREATE TRIGGER native_mcp_server_connection_revision
AFTER UPDATE ON native_mcp_server
BEGIN
  UPDATE native_mcp_connection SET revision = revision + 1 WHERE server_id = NEW.id;
END;
