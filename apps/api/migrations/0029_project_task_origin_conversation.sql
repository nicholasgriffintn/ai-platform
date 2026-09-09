ALTER TABLE `project_task` ADD `origin_conversation_id` text REFERENCES conversation(id);--> statement-breakpoint
CREATE INDEX `project_task_origin_conversation_idx` ON `project_task` (`origin_conversation_id`);
