UPDATE `user_settings`
SET `guardrails_provider` = 'typesafe'
WHERE `guardrails_provider` IS NULL OR `guardrails_provider` = 'llamaguard';--> statement-breakpoint
UPDATE `user_settings`
SET `guardrails_enabled` = 1
WHERE `guardrails_enabled` IS NULL OR `guardrails_enabled` = 0;
