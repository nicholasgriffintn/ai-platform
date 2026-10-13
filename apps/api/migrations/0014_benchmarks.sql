CREATE TABLE `benchmark_run` (
	`id` text PRIMARY KEY NOT NULL,
	`benchmark_id` text NOT NULL,
	`version` integer NOT NULL,
	`scope` text NOT NULL,
	`entrant_key` text NOT NULL,
	`entrant` text NOT NULL,
	`owner_user_id` integer,
	`workspace_id` text,
	`status` text NOT NULL,
	`visibility` text NOT NULL,
	`share_token` text,
	`items_total` integer NOT NULL,
	`items_completed` integer DEFAULT 0 NOT NULL,
	`score` text,
	`metrics` text NOT NULL,
	`rating` text,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cost_usd` real,
	`latency_p50_ms` real,
	`failure_reason` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	`completed_at` text,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `benchmark_run_board_idx` ON `benchmark_run` (`benchmark_id`,`version`,`scope`,`status`);--> statement-breakpoint
CREATE INDEX `benchmark_run_entrant_idx` ON `benchmark_run` (`scope`,`entrant_key`);--> statement-breakpoint
CREATE INDEX `benchmark_run_owner_idx` ON `benchmark_run` (`owner_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `benchmark_run_workspace_idx` ON `benchmark_run` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `benchmark_run_share_token_idx` ON `benchmark_run` (`share_token`);--> statement-breakpoint
CREATE TABLE `benchmark_vote` (
	`id` text PRIMARY KEY NOT NULL,
	`benchmark_id` text NOT NULL,
	`version` integer NOT NULL,
	`pair_key` text NOT NULL,
	`left_run_id` text NOT NULL,
	`right_run_id` text NOT NULL,
	`item_id` text NOT NULL,
	`winner` text NOT NULL,
	`voter_user_id` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`left_run_id`) REFERENCES `benchmark_run`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`right_run_id`) REFERENCES `benchmark_run`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`voter_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `benchmark_vote_voter_pair_idx` ON `benchmark_vote` (`voter_user_id`,`pair_key`);--> statement-breakpoint
CREATE INDEX `benchmark_vote_board_idx` ON `benchmark_vote` (`benchmark_id`,`version`,`created_at`);