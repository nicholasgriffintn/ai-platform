CREATE TABLE `decision_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`policy_key` text NOT NULL,
	`policy_version` text NOT NULL,
	`user_id` integer NOT NULL,
	`recommended_outcome` text NOT NULL,
	`corrected_outcome` text NOT NULL,
	`summary` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `decision_feedback_policy_idx` ON `decision_feedback` (`policy_key`,`policy_version`,`created_at`);--> statement-breakpoint
CREATE INDEX `decision_feedback_user_idx` ON `decision_feedback` (`user_id`,`policy_key`,`created_at`);
