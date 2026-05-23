ALTER TABLE `user_settings` ADD `speech_provider` text DEFAULT 'melotts';--> statement-breakpoint
ALTER TABLE `user_settings` ADD `speech_model` text DEFAULT '@cf/myshell-ai/melotts';
