DROP INDEX `tasks_user_id_idx`;--> statement-breakpoint
CREATE INDEX `tasks_user_type_status_idx` ON `tasks` (`user_id`,`task_type`,`status`);