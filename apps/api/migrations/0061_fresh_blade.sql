DROP INDEX `project_workspace_name_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `project_workspace_name_idx` ON `project` (`workspace_id`,`name`) WHERE "project"."archived_at" IS NULL;