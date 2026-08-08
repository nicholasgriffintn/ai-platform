CREATE TABLE `oauth_state` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`code_verifier` text,
	`nonce` text,
	`redirect_uri` text,
	`context` text,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oauth_state_expires_at_idx` ON `oauth_state` (`expires_at`);
--> statement-breakpoint
CREATE TABLE `auth_challenge` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_challenge_expires_at_idx` ON `auth_challenge` (`expires_at`);
--> statement-breakpoint
DELETE FROM `passkey`;
