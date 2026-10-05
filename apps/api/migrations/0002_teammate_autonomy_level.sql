ALTER TABLE `teammate_context` ADD `autonomy_level` text;--> statement-breakpoint
UPDATE `teammate_context` SET `autonomy_level` = 'assistant' WHERE `teammate_id` = 'platform-poly';
