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
CREATE UNIQUE INDEX `enterprise_identity_connection_workspace_idx` ON `enterprise_identity_connection` (`workspace_id`);--> statement-breakpoint
ALTER TABLE `workspace_member` ADD `managed_connection_id` text;--> statement-breakpoint
ALTER TABLE `workspace_member` ADD `managed_connection_revision` integer;--> statement-breakpoint
ALTER TABLE `workspace_member` ADD `identity_lease_expires_at` text;
--> statement-breakpoint
CREATE VIEW active_workspace_member AS
SELECT wm.* FROM workspace_member wm
LEFT JOIN enterprise_identity_connection connection ON connection.id = wm.managed_connection_id
WHERE (wm.managed_connection_id IS NULL AND wm.managed_connection_revision IS NULL AND wm.identity_lease_expires_at IS NULL)
OR (connection.workspace_id = wm.workspace_id AND connection.enabled = 1
    AND connection.revision = wm.managed_connection_revision
    AND wm.role IN ('admin', 'member')
    AND julianday(wm.identity_lease_expires_at) > julianday('now'));
