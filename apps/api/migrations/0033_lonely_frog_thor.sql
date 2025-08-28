ALTER TABLE `user_settings` ADD `transcription_provider` text DEFAULT 'workers';--> statement-breakpoint
ALTER TABLE `user_settings` ADD `transcription_model` text DEFAULT 'whisper';