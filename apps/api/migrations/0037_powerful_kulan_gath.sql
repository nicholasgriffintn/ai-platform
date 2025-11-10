CREATE TABLE `training_examples` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer,
	`conversation_id` text,
	`source` text NOT NULL,
	`app_name` text,
	`user_prompt` text NOT NULL,
	`assistant_response` text NOT NULL,
	`system_prompt` text,
	`model_used` text,
	`feedback_rating` integer,
	`feedback_comment` text,
	`metadata` text,
	`exported` integer DEFAULT false,
	`exported_at` text,
	`quality_score` integer,
	`include_in_training` integer DEFAULT true,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `training_examples_user_id_idx` ON `training_examples` (`user_id`);--> statement-breakpoint
CREATE INDEX `training_examples_conversation_id_idx` ON `training_examples` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `training_examples_source_idx` ON `training_examples` (`source`);--> statement-breakpoint
CREATE INDEX `training_examples_app_name_idx` ON `training_examples` (`app_name`);--> statement-breakpoint
CREATE INDEX `training_examples_exported_idx` ON `training_examples` (`exported`);--> statement-breakpoint
CREATE INDEX `training_examples_include_in_training_idx` ON `training_examples` (`include_in_training`);--> statement-breakpoint
CREATE INDEX `training_examples_feedback_rating_idx` ON `training_examples` (`feedback_rating`);--> statement-breakpoint
CREATE INDEX `training_examples_quality_score_idx` ON `training_examples` (`quality_score`);