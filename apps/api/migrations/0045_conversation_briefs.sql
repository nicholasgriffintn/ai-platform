ALTER TABLE `memory_document` ADD `kind` text NOT NULL DEFAULT 'memory';
--> statement-breakpoint
ALTER TABLE `conversation` ADD `brief_document_id` text REFERENCES memory_document(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX `conversation_brief_document_idx` ON `conversation` (`brief_document_id`);
--> statement-breakpoint
ALTER TABLE `delegation` ADD `memory_bindings_json` text NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE `delegation` ADD `predecessor_delegation_id` text;
--> statement-breakpoint
ALTER TABLE `delegation` ADD `continuation_mode` text NOT NULL DEFAULT 'new';
--> statement-breakpoint
ALTER TABLE `conversation_run` ADD `interaction_kind` text;
--> statement-breakpoint
ALTER TABLE `conversation_run` ADD `teammate_context_id` text REFERENCES `teammate_context`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE `conversation_run` ADD `computer_id` text REFERENCES `teammate_computer`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE `conversation_run` ADD `resolved_configuration_json` text;
--> statement-breakpoint
ALTER TABLE `channel_binding` ADD `interaction_mode` text NOT NULL DEFAULT 'automated';
--> statement-breakpoint
CREATE TABLE `teammate_context` (
  `id` text PRIMARY KEY NOT NULL,
  `teammate_id` text NOT NULL REFERENCES `teammates`(`id`) ON DELETE CASCADE,
  `actor_user_id` integer NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `scope_type` text NOT NULL,
  `scope_id` text NOT NULL,
  `home_conversation_id` text NOT NULL REFERENCES `conversation`(`id`) ON DELETE CASCADE,
  `memory_document_id` text NOT NULL REFERENCES `memory_document`(`id`) ON DELETE CASCADE,
  `status` text DEFAULT 'active' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teammate_context_identity_idx` ON `teammate_context` (`teammate_id`,`actor_user_id`,`scope_type`,`scope_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `teammate_context_home_conversation_idx` ON `teammate_context` (`home_conversation_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `teammate_context_memory_document_idx` ON `teammate_context` (`memory_document_id`);
--> statement-breakpoint
CREATE TABLE `teammate_connection_grant` (
  `id` text PRIMARY KEY NOT NULL,
  `context_id` text NOT NULL REFERENCES `teammate_context`(`id`) ON DELETE CASCADE,
  `connection_id` text NOT NULL REFERENCES `provider_connection`(`id`) ON DELETE CASCADE,
  `allowed_operations` text NOT NULL,
  `revision` integer DEFAULT 1 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teammate_connection_grant_context_connection_idx` ON `teammate_connection_grant` (`context_id`,`connection_id`);
--> statement-breakpoint
CREATE TABLE `teammate_computer` (
  `id` text PRIMARY KEY NOT NULL,
  `context_id` text NOT NULL REFERENCES `teammate_context`(`id`) ON DELETE CASCADE,
  `provider` text NOT NULL,
  `provider_handle` text,
  `checkpoint_reference` text,
  `status` text DEFAULT 'stopped' NOT NULL,
  `lease_kind` text,
  `lease_owner_id` text,
  `lease_expires_at` text,
  `lease_fence` integer DEFAULT 0 NOT NULL,
  `last_error` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teammate_computer_context_idx` ON `teammate_computer` (`context_id`);
--> statement-breakpoint
CREATE INDEX `teammate_computer_lease_idx` ON `teammate_computer` (`lease_expires_at`);
--> statement-breakpoint
ALTER TABLE `composio_connector_session` ADD `teammate_context_id` text REFERENCES `teammate_context`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE `composio_connector_session` ADD `project_id` text;
--> statement-breakpoint
ALTER TABLE `connector_operation_approval` ADD `authority_revision` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `connector_operation_approval` ADD `arguments_json` text NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE `connector_operation_approval` ADD `recipe_id` text;
--> statement-breakpoint
ALTER TABLE `connector_operation_approval` ADD `installation_id` text;
--> statement-breakpoint
ALTER TABLE `connector_operation_approval` ADD `project_id` text;
--> statement-breakpoint
ALTER TABLE `connector_operation_approval` ADD `teammate_context_id` text;
--> statement-breakpoint
ALTER TABLE `memory_document_revision` ADD `operation_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `memory_document_revision_document_operation_idx` ON `memory_document_revision` (`document_id`,`operation_id`) WHERE `operation_id` IS NOT NULL;
