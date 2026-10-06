CREATE TABLE `poly_handoff` (
	`id` text PRIMARY KEY NOT NULL,
	`context_id` text NOT NULL,
	`source_kind` text NOT NULL,
	`source_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`result_conversation_id` text,
	`urgency` text NOT NULL,
	`decision` text NOT NULL,
	`reason` text NOT NULL,
	`admission_receipt_json` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`context_id`) REFERENCES `teammate_context`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `poly_handoff_context_fingerprint_idx` ON `poly_handoff` (`context_id`,`fingerprint`);--> statement-breakpoint
CREATE INDEX `poly_handoff_context_decision_idx` ON `poly_handoff` (`context_id`,`decision`,`created_at`);
