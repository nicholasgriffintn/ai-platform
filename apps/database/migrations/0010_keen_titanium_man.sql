ALTER TABLE `user_settings` ADD `embedding_provider` text DEFAULT 'vectorize';--> statement-breakpoint
ALTER TABLE `user_settings` ADD `bedrock_knowledge_base_id` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `bedrock_knowledge_base_custom_data_source_id` text;