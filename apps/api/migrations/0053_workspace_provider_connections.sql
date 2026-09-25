CREATE TABLE `workspace_provider_connection` (
	`workspace_id` text NOT NULL,
	`provider` text NOT NULL,
	`encrypted_secret` text NOT NULL,
	`account` text,
	`config` text DEFAULT '{}' NOT NULL,
	`updated_by` integer,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`workspace_id`, `provider`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
