CREATE TABLE `artificial_analysis_models` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text,
	`creator_id` text,
	`creator_name` text,
	`creator_slug` text,
	`evaluations` text NOT NULL,
	`pricing` text NOT NULL,
	`intelligence_index` real,
	`coding_index` real,
	`agentic_index` real,
	`intelligence_index_version` real,
	`price_1m_blended_3_to_1` real,
	`price_1m_input_tokens` real,
	`price_1m_output_tokens` real,
	`median_output_tokens_per_second` real,
	`median_time_to_first_token_seconds` real,
	`median_time_to_first_answer_token_seconds` real,
	`median_end_to_end_response_time_seconds` real,
	`derived_strengths` text,
	`derived_scores` text,
	`source` text DEFAULT 'artificial_analysis' NOT NULL,
	`source_url` text DEFAULT 'https://artificialanalysis.ai/' NOT NULL,
	`ingested_at` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE INDEX `artificial_analysis_models_slug_idx` ON `artificial_analysis_models` (`slug`);--> statement-breakpoint
CREATE INDEX `artificial_analysis_models_creator_slug_idx` ON `artificial_analysis_models` (`creator_slug`);--> statement-breakpoint
CREATE INDEX `artificial_analysis_models_ingested_at_idx` ON `artificial_analysis_models` (`ingested_at`);