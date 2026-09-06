CREATE TABLE `memory_document` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text NOT NULL,
	`name` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by` integer NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "memory_document_scope_type_check" CHECK("memory_document"."scope_type" IN ('personal', 'project'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memory_document_scope_name_idx` ON `memory_document` (`scope_type`,`scope_id`,`name`) WHERE "memory_document"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX `memory_document_scope_idx` ON `memory_document` (`scope_type`,`scope_id`);--> statement-breakpoint
CREATE TABLE `memory_document_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`revision` integer NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`change_note` text,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `memory_document`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memory_document_revision_document_revision_idx` ON `memory_document_revision` (`document_id`,`revision`);