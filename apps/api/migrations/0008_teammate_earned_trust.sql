ALTER TABLE `teammate_context` ADD `approval_streaks` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `teammate_context` ADD `owner_seen_at` text;--> statement-breakpoint
UPDATE `teammate_context` SET `owner_seen_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
