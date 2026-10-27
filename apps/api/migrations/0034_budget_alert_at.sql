ALTER TABLE `workspace_teammate` ADD `budget_alert_at` text;
UPDATE `workspace_teammate` SET `budget_alert_at` = `updated_at` WHERE `budget_warned_period` IS NOT NULL OR `paused_reason` = 'budget';
