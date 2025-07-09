ALTER TABLE `conversation` ADD `parent_conversation_id` text REFERENCES conversation(id);--> statement-breakpoint
ALTER TABLE `conversation` ADD `parent_message_id` text;--> statement-breakpoint
CREATE INDEX `conversation_parent_conversation_id_idx` ON `conversation` (`parent_conversation_id`);--> statement-breakpoint
CREATE INDEX `conversation_parent_message_id_idx` ON `conversation` (`parent_message_id`);