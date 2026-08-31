CREATE TABLE `authored_skill` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text NOT NULL,
	`name` text NOT NULL,
	`created_by` integer NOT NULL,
	`draft_revision_id` text NOT NULL,
	`stable_revision_id` text NOT NULL,
	`state_version` integer DEFAULT 1 NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "authored_skill_scope_type_check" CHECK("authored_skill"."scope_type" IN ('personal', 'project')),
	CONSTRAINT "authored_skill_state_version_check" CHECK("authored_skill"."state_version" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `authored_skill_scope_name_idx` ON `authored_skill` (`scope_type`,`scope_id`,`name`) WHERE "authored_skill"."archived_at" IS NULL;--> statement-breakpoint
CREATE TABLE `authored_skill_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`revision` integer NOT NULL,
	`description` text NOT NULL,
	`change_note` text,
	`digest` text NOT NULL,
	`storage_key` text NOT NULL,
	`size` integer NOT NULL,
	`source_skill_id` text,
	`source_revision_id` text,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `authored_skill`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "authored_skill_revision_number_check" CHECK("authored_skill_revision"."revision" >= 1),
	CONSTRAINT "authored_skill_revision_size_check" CHECK("authored_skill_revision"."size" >= 0),
	CONSTRAINT "authored_skill_revision_source_check" CHECK(("authored_skill_revision"."source_skill_id" IS NULL AND "authored_skill_revision"."source_revision_id" IS NULL) OR ("authored_skill_revision"."source_skill_id" IS NOT NULL AND "authored_skill_revision"."source_revision_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `authored_skill_revision_storage_key_unique` ON `authored_skill_revision` (`storage_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `authored_skill_revision_skill_revision_idx` ON `authored_skill_revision` (`skill_id`,`revision`);