CREATE TABLE `document_comment` (
	`id` text PRIMARY KEY NOT NULL,
	`output_id` text NOT NULL,
	`parent_id` text,
	`anchor_json` text,
	`source_revision` integer NOT NULL,
	`body` text NOT NULL,
	`author_user_id` integer NOT NULL,
	`resolved` integer DEFAULT false NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`mentioned_teammate_id` text,
	`task_id` text,
	`created_at` text NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`output_id`) REFERENCES `output`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `document_comment`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "document_comment_source_revision_check" CHECK("document_comment"."source_revision" > 0),
	CONSTRAINT "document_comment_revision_check" CHECK("document_comment"."revision" > 0)
);
--> statement-breakpoint
CREATE INDEX `document_comment_output_idx` ON `document_comment` (`output_id`,`created_at`,`id`);
--> statement-breakpoint
CREATE TRIGGER document_comment_revision_guard
BEFORE INSERT ON document_comment
WHEN NOT EXISTS (
  SELECT 1 FROM output
  WHERE id = NEW.output_id AND kind = 'document' AND revision = NEW.source_revision
)
BEGIN
  SELECT RAISE(ABORT, 'document_revision_conflict');
END;
--> statement-breakpoint
CREATE TRIGGER document_comment_authority_guard
BEFORE INSERT ON document_comment
WHEN NOT EXISTS (
  SELECT 1 FROM output WHERE id = NEW.output_id
    AND ((project_id IS NULL AND created_by_user_id = NEW.author_user_id)
      OR EXISTS (SELECT 1 FROM project JOIN workspace_member ON workspace_member.workspace_id = project.workspace_id
        WHERE project.id = output.project_id AND workspace_member.user_id = NEW.author_user_id))
)
BEGIN
  SELECT RAISE(ABORT, 'document_access_revoked');
END;
--> statement-breakpoint
CREATE TRIGGER document_comment_parent_guard
BEFORE INSERT ON document_comment
WHEN NEW.parent_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM document_comment
  WHERE id = NEW.parent_id AND output_id = NEW.output_id AND parent_id IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'document_thread_conflict');
END;
