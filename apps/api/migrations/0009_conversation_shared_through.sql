ALTER TABLE `conversation` ADD `shared_through` integer;
--> statement-breakpoint
UPDATE `conversation` SET `shared_through` = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE `is_public` = 1;
