ALTER TABLE `embedding_chunk` ADD `embedding_dimensions` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `embedding_chunk` ADD `distance_metric` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `embedding_chunk` ADD `task_mode` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `embedding_document` ADD `embedding_dimensions` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `embedding_document` ADD `distance_metric` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `embedding_document` ADD `task_mode` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
-- Phase 1 wrote this fixed Workers AI model before complete runtime provenance existed.
-- Legacy quarantine rows retain the deliberately incompatible defaults above.
UPDATE `embedding_document`
SET `embedding_dimensions` = 1024,
	`distance_metric` = 'provider-configured',
	`task_mode` = 'symmetric'
WHERE `embedding_model` = '@cf/baai/bge-large-en-v1.5'
	AND `vector_space_version` = 'v1';--> statement-breakpoint
UPDATE `embedding_chunk`
SET `embedding_dimensions` = 1024,
	`distance_metric` = 'provider-configured',
	`task_mode` = 'symmetric'
WHERE `embedding_model` = '@cf/baai/bge-large-en-v1.5'
	AND `vector_space_version` = 'v1';
