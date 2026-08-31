CREATE TABLE `embedding_chunk` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`vector_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`content` text NOT NULL,
	`metadata` text NOT NULL,
	`lifecycle_status` text DEFAULT 'pending' NOT NULL,
	`provider` text NOT NULL,
	`provider_target` text DEFAULT 'quarantined-legacy' NOT NULL,
	`embedding_model` text DEFAULT 'unknown-legacy' NOT NULL,
	`vector_space` text NOT NULL,
	`vector_space_version` text DEFAULT 'legacy' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`document_id`) REFERENCES `embedding_document`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "embedding_chunk_lifecycle_check" CHECK("embedding_chunk"."lifecycle_status" IN ('pending', 'active', 'delete_pending'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `embedding_chunk_document_index_idx` ON `embedding_chunk` (`document_id`,`chunk_index`);--> statement-breakpoint
CREATE UNIQUE INDEX `embedding_chunk_vector_id_idx` ON `embedding_chunk` (`vector_id`);--> statement-breakpoint
CREATE INDEX `embedding_chunk_document_lifecycle_idx` ON `embedding_chunk` (`document_id`,`lifecycle_status`);--> statement-breakpoint
CREATE TABLE `embedding_document` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_type` text DEFAULT 'personal' NOT NULL,
	`user_id` integer NOT NULL,
	`logical_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`metadata` text NOT NULL,
	`lifecycle_status` text DEFAULT 'pending' NOT NULL,
	`provider` text NOT NULL,
	`provider_target` text DEFAULT 'quarantined-legacy' NOT NULL,
	`embedding_model` text DEFAULT 'unknown-legacy' NOT NULL,
	`vector_space` text NOT NULL,
	`vector_space_version` text DEFAULT 'legacy' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "embedding_document_lifecycle_check" CHECK("embedding_document"."lifecycle_status" IN ('pending', 'active', 'delete_pending')),
	CONSTRAINT "embedding_document_personal_scope_check" CHECK("embedding_document"."scope_type" = 'personal')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `embedding_document_user_logical_id_idx` ON `embedding_document` (`user_id`,`logical_id`);--> statement-breakpoint
CREATE INDEX `embedding_document_user_lifecycle_idx` ON `embedding_document` (`user_id`,`lifecycle_status`);