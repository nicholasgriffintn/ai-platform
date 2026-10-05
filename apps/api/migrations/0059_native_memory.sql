CREATE TABLE `memory_reflection_checkpoint` (
	`id` text PRIMARY KEY NOT NULL,
	`context_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`message_id` text NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`context_id`) REFERENCES `teammate_context`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memory_reflection_checkpoint_context_conversation_idx` ON `memory_reflection_checkpoint` (`context_id`,`conversation_id`);--> statement-breakpoint
CREATE TABLE `memory_reflection_result` (
	`id` text PRIMARY KEY NOT NULL,
	`context_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`through_message_id` text NOT NULL,
	`revision` integer NOT NULL,
	`status` text NOT NULL,
	`evidence_json` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`context_id`) REFERENCES `teammate_context`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `memory_document` ADD `tier` text DEFAULT 'core' NOT NULL;--> statement-breakpoint
ALTER TABLE `memory_document` ADD `summary` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `memory_document_revision` ADD `tier` text DEFAULT 'core' NOT NULL;--> statement-breakpoint
ALTER TABLE `memory_document_revision` ADD `summary` text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE conversation_run
SET context_json = json_set(context_json, '$.protocolVersion', 2, '$.documents', json((
  SELECT json_group_array(json_object(
    'id', json_extract(entry.value, '$.id'),
    'name', COALESCE(document.name, json_extract(entry.value, '$.id')),
    'kind', json_extract(entry.value, '$.kind'),
    'revision', json_extract(entry.value, '$.revision'),
    'access', json_extract(entry.value, '$.access'),
    'tier', 'core', 'status', 'included', 'reason', NULL, 'contentTokens', NULL
  ))
  FROM json_each(context_json, '$.documents') entry
  LEFT JOIN memory_document document ON document.id = json_extract(entry.value, '$.id')
)))
WHERE json_valid(context_json) AND json_extract(context_json, '$.protocolVersion') = 1;
