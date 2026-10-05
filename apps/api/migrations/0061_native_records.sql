CREATE TABLE `native_record` (
	`id` text PRIMARY KEY NOT NULL,
	`table_id` text NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`values_json` text NOT NULL,
	`creation_hash` text NOT NULL,
	`validated_table_revision` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text,
	`deleted_at` text,
	FOREIGN KEY (`table_id`) REFERENCES `output`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "native_record_revision_check" CHECK("native_record"."revision" > 0 AND "native_record"."validated_table_revision" > 0),
	CONSTRAINT "native_record_values_check" CHECK(json_valid("native_record"."values_json") AND json_type("native_record"."values_json") = 'object' AND length(CAST("native_record"."values_json" AS BLOB)) <= 65536)
);
--> statement-breakpoint
CREATE INDEX `native_record_table_idx` ON `native_record` (`table_id`,`deleted_at`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `native_record_owner_idx` ON `native_record` (`table_id`,`created_by_user_id`,`deleted_at`);--> statement-breakpoint
CREATE TABLE `native_record_change` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`table_id` text NOT NULL,
	`record_id` text NOT NULL,
	`record_revision` integer NOT NULL,
	`record_owner_user_id` integer NOT NULL,
	`changed_by_user_id` integer NOT NULL,
	`operation` text NOT NULL,
	`trigger_eligible` integer DEFAULT true NOT NULL,
	`record_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`table_id`) REFERENCES `output`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`record_id`) REFERENCES `native_record`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`record_owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`changed_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "native_record_change_operation_check" CHECK("native_record_change"."operation" IN ('created', 'updated', 'deleted'))
);
--> statement-breakpoint
CREATE INDEX `native_record_change_table_idx` ON `native_record_change` (`table_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `native_record_change_owner_idx` ON `native_record_change` (`table_id`,`record_owner_user_id`,`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `native_record_change_revision_idx` ON `native_record_change` (`table_id`,`record_id`,`record_revision`);
--> statement-breakpoint
CREATE TRIGGER native_record_limit BEFORE INSERT ON native_record
WHEN NEW.deleted_at IS NULL AND (SELECT COUNT(*) FROM native_record WHERE table_id = NEW.table_id AND deleted_at IS NULL) >= 10000
BEGIN
  SELECT RAISE(ABORT, 'native_record_limit');
END;
--> statement-breakpoint
CREATE TRIGGER native_record_identity BEFORE UPDATE ON native_record
WHEN NEW.id != OLD.id OR NEW.table_id != OLD.table_id OR NEW.created_by_user_id != OLD.created_by_user_id
  OR NEW.creation_hash != OLD.creation_hash OR NEW.created_at != OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'native_record_identity');
END;
