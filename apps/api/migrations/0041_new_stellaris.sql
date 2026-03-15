ALTER TABLE `message` ADD `is_archived` integer DEFAULT false;--> statement-breakpoint
CREATE INDEX `message_archived_idx` ON `message` (`is_archived`);