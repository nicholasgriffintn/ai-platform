ALTER TABLE `template` ADD `project_id` text REFERENCES project(id);--> statement-breakpoint
CREATE INDEX `template_project_id_idx` ON `template` (`project_id`);