ALTER TABLE `conversation` ADD `type` text DEFAULT 'chat' NOT NULL;--> statement-breakpoint
CREATE INDEX `conversation_type_idx` ON `conversation` (`type`);