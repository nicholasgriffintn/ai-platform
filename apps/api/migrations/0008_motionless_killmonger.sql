ALTER TABLE `user_settings` ADD `guardrails_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `guardrails_provider` text DEFAULT 'llamaguard';