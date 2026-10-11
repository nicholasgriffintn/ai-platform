CREATE TABLE `output_review` (
	`id` text PRIMARY KEY NOT NULL,
	`output_id` text NOT NULL,
	`output_revision` integer NOT NULL,
	`output_kind` text NOT NULL,
	`reviewed_by_user_id` integer NOT NULL,
	`project_id` text,
	`verdict` text NOT NULL,
	`brief` text NOT NULL,
	`dissent` text NOT NULL,
	`seats` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`output_id`) REFERENCES `resource`(`output_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `output_review_output_idx` ON `output_review` (`output_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `output_review_kind_idx` ON `output_review` (`reviewed_by_user_id`,`output_kind`,`created_at`);