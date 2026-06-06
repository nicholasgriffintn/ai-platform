ALTER TABLE `user_settings` ADD `sms_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `sms_provider` text DEFAULT 'twilio-sms';--> statement-breakpoint
ALTER TABLE `user_settings` ADD `sms_model` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `sms_model_provider` text;
