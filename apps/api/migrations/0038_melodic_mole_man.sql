ALTER TABLE `training_examples` ADD `task_category` text;--> statement-breakpoint
ALTER TABLE `training_examples` ADD `difficulty_level` text;--> statement-breakpoint
ALTER TABLE `training_examples` ADD `language_code` text DEFAULT 'en';--> statement-breakpoint
ALTER TABLE `training_examples` ADD `user_prompt_tokens` integer;--> statement-breakpoint
ALTER TABLE `training_examples` ADD `assistant_response_tokens` integer;--> statement-breakpoint
ALTER TABLE `training_examples` ADD `response_time_ms` integer;--> statement-breakpoint
ALTER TABLE `training_examples` ADD `conversation_turn` integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE `training_examples` ADD `conversation_context` text;--> statement-breakpoint
ALTER TABLE `training_examples` ADD `user_satisfaction_signals` text;--> statement-breakpoint
CREATE INDEX `training_examples_task_category_idx` ON `training_examples` (`task_category`);--> statement-breakpoint
CREATE INDEX `training_examples_difficulty_level_idx` ON `training_examples` (`difficulty_level`);--> statement-breakpoint
CREATE INDEX `training_examples_language_code_idx` ON `training_examples` (`language_code`);--> statement-breakpoint
CREATE INDEX `training_examples_conversation_turn_idx` ON `training_examples` (`conversation_turn`);