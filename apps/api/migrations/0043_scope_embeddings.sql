ALTER TABLE `embedding` ADD `user_id` integer REFERENCES `user`(`id`);--> statement-breakpoint
CREATE INDEX `embedding_namespace_idx` ON `embedding` (`namespace`);--> statement-breakpoint
CREATE INDEX `embedding_user_id_idx` ON `embedding` (`user_id`);--> statement-breakpoint
CREATE INDEX `embedding_scope_lookup_idx` ON `embedding` (`id`,`type`,`namespace`,`user_id`);
