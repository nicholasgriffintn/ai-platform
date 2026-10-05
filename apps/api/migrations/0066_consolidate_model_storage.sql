CREATE TABLE "model_configuration" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
  "project_id" TEXT REFERENCES "project"("id") ON DELETE CASCADE,
  "scope_key" TEXT NOT NULL,
  "name" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "encrypted_secret" TEXT,
  "data" TEXT NOT NULL,
  "created_by" INTEGER REFERENCES "user"("id") ON DELETE SET NULL,
  "updated_by" INTEGER REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  "updated_at" TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  CONSTRAINT "model_configuration_shape_check" CHECK (("kind" IN ('policy', 'budget')) OR ("kind" IN ('suite', 'grader') AND "name" IS NOT NULL) OR ("kind" = 'connection' AND "project_id" IS NULL AND "encrypted_secret" IS NOT NULL)),
  PRIMARY KEY ("kind", "id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "model_configuration_scope_idx" ON "model_configuration" ("workspace_id", "kind", "scope_key");
--> statement-breakpoint
CREATE INDEX "model_configuration_workspace_idx" ON "model_configuration" ("workspace_id", "kind", "project_id");
--> statement-breakpoint
CREATE TABLE "model_operation" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
  "project_id" TEXT REFERENCES "project"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL,
  "name" TEXT,
  "provider" TEXT,
  "provider_ref" TEXT,
  "claim_started_at" TEXT,
  "desired_state" TEXT,
  "version_id" TEXT REFERENCES "model_asset_version"("id") ON DELETE CASCADE,
  "output_version_id" TEXT REFERENCES "model_asset_version"("id") ON DELETE SET NULL,
  "subject_version_id" TEXT,
  "suite_id" TEXT,
  "suite_kind" TEXT NOT NULL DEFAULT "suite",
  "route_id" TEXT,
  "evaluation_route_id" TEXT REFERENCES "model_route"("id") ON DELETE CASCADE,
  "trigger" TEXT,
  "billed_until" TEXT,
  "data" TEXT NOT NULL,
  "failure_reason" TEXT,
  "created_by" INTEGER REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  "updated_at" TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  "started_at" TEXT,
  "completed_at" TEXT,
  "last_checked_at" TEXT,
  CONSTRAINT "model_operation_suite_kind_check" CHECK ("suite_kind" = 'suite'),
  CONSTRAINT "model_operation_shape_check" CHECK (("kind" = 'training' AND "provider" IS NOT NULL) OR ("kind" = 'evaluation' AND "suite_id" IS NOT NULL AND "evaluation_route_id" IS NOT NULL AND "subject_version_id" IS NOT NULL AND "trigger" IS NOT NULL) OR ("kind" = 'deployment' AND "name" IS NOT NULL AND "version_id" IS NOT NULL AND "provider" IS NOT NULL AND "desired_state" IS NOT NULL) OR ("kind" = 'upload' AND "name" IS NOT NULL)),
  PRIMARY KEY ("kind", "id"),
  FOREIGN KEY ("suite_kind", "suite_id") REFERENCES "model_configuration" ("kind", "id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX "model_operation_workspace_idx" ON "model_operation" ("kind", "workspace_id", "status", "created_at");
--> statement-breakpoint
CREATE INDEX "model_operation_active_idx" ON "model_operation" ("kind", "status", "last_checked_at");
--> statement-breakpoint
CREATE INDEX "model_operation_suite_idx" ON "model_operation" ("kind", "suite_id", "evaluation_route_id", "created_at");
--> statement-breakpoint
CREATE INDEX "model_operation_route_idx" ON "model_operation" ("kind", "evaluation_route_id", "created_at");
--> statement-breakpoint
CREATE INDEX "model_operation_completed_idx" ON "model_operation" ("kind", "suite_id", "evaluation_route_id", "status", "completed_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "model_operation_deployment_name_idx" ON "model_operation" ("workspace_id", "name") WHERE "kind" = 'deployment';
--> statement-breakpoint
CREATE TABLE "model_record" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "version_id" TEXT REFERENCES "model_asset_version"("id") ON DELETE CASCADE,
  "route_id" TEXT,
  "configuration_id" TEXT,
  "configuration_kind" TEXT NOT NULL DEFAULT "policy",
  "alias_id" TEXT REFERENCES "model_alias"("id") ON DELETE CASCADE,
  "operation_id" TEXT,
  "operation_kind" TEXT NOT NULL DEFAULT "training",
  "output_version_id" TEXT REFERENCES "model_asset_version"("id") ON DELETE SET NULL,
  "event_kind" TEXT,
  "ordinal" INTEGER,
  "status" TEXT,
  "source" TEXT,
  "data" TEXT NOT NULL,
  "actor_user_id" INTEGER REFERENCES "user"("id") ON DELETE SET NULL,
  "created_by" INTEGER,
  "created_at" TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  CONSTRAINT "model_record_parent_kind_check" CHECK ("configuration_kind" = 'policy' AND "operation_kind" = 'training'),
  CONSTRAINT "model_record_shape_check" CHECK (("kind" = 'evidence' AND "version_id" IS NOT NULL AND "event_kind" IS NOT NULL AND "status" IS NOT NULL AND "source" IS NOT NULL AND "configuration_id" IS NULL AND "alias_id" IS NULL AND "operation_id" IS NULL) OR ("kind" = 'policy_revision' AND "configuration_id" IS NOT NULL AND "ordinal" IS NOT NULL AND "version_id" IS NULL AND "alias_id" IS NULL AND "operation_id" IS NULL) OR ("kind" = 'alias_event' AND "alias_id" IS NOT NULL AND "event_kind" IS NOT NULL AND "version_id" IS NULL AND "configuration_id" IS NULL AND "operation_id" IS NULL) OR ("kind" = 'checkpoint' AND "operation_id" IS NOT NULL AND "ordinal" IS NOT NULL AND "version_id" IS NULL AND "configuration_id" IS NULL AND "alias_id" IS NULL)),
  PRIMARY KEY ("kind", "id"),
  FOREIGN KEY ("configuration_kind", "configuration_id") REFERENCES "model_configuration" ("kind", "id") ON DELETE CASCADE,
  FOREIGN KEY ("operation_kind", "operation_id") REFERENCES "model_operation" ("kind", "id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX "model_record_evidence_idx" ON "model_record" ("kind", "version_id", "event_kind", "created_at");
--> statement-breakpoint
CREATE INDEX "model_record_alias_idx" ON "model_record" ("kind", "alias_id", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "model_record_revision_idx" ON "model_record" ("configuration_id", "ordinal");
--> statement-breakpoint
CREATE UNIQUE INDEX "model_record_checkpoint_idx" ON "model_record" ("operation_id", "ordinal");
--> statement-breakpoint
CREATE TABLE "model_approval" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
  "project_id" TEXT REFERENCES "project"("id") ON DELETE CASCADE,
  "version_id" TEXT REFERENCES "model_asset_version"("id") ON DELETE CASCADE,
  "route_id" TEXT REFERENCES "model_route"("id") ON DELETE CASCADE,
  "state" TEXT NOT NULL,
  "subject_type" TEXT,
  "subject_id" TEXT,
  "data" TEXT NOT NULL,
  "requested_by" INTEGER REFERENCES "user"("id") ON DELETE SET NULL,
  "decided_by" INTEGER REFERENCES "user"("id") ON DELETE SET NULL,
  "decided_at" TEXT,
  "expires_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  CONSTRAINT "model_approval_shape_check" CHECK (("kind" = 'decision' AND "version_id" IS NOT NULL) OR ("kind" = 'spend' AND "subject_type" IS NOT NULL AND "subject_type" IN ('training_run', 'deployment'))),
  PRIMARY KEY ("kind", "id")
);
--> statement-breakpoint
CREATE INDEX "model_approval_workspace_idx" ON "model_approval" ("kind", "workspace_id", "state", "created_at");
--> statement-breakpoint
CREATE INDEX "model_approval_version_idx" ON "model_approval" ("kind", "version_id", "route_id");
--> statement-breakpoint
CREATE INDEX "model_approval_expiration_idx" ON "model_approval" ("kind", "state", "expires_at");
--> statement-breakpoint
INSERT INTO "model_configuration" ("kind", "id", "workspace_id", "project_id", "scope_key", "revision", "updated_by", "updated_at", "data")
SELECT 'policy', "id", "workspace_id", "project_id", "scope_key", "revision", "updated_by", "updated_at", json_object('rules', json("rules"), 'hash', "hash", 'enforcement', "enforcement") FROM "model_policy";
--> statement-breakpoint
INSERT INTO "model_configuration" ("kind", "id", "workspace_id", "project_id", "scope_key", "updated_by", "updated_at", "data")
SELECT 'budget', "id", "workspace_id", "project_id", "scope_key", "updated_by", "updated_at", json_object('monthly_limit_usd', "monthly_limit_usd", 'soft_limit_percent', "soft_limit_percent", 'hard_stop', json(CASE WHEN "hard_stop" THEN 'true' ELSE 'false' END), 'approval_above_usd', "approval_above_usd", 'idle_pause_minutes', "idle_pause_minutes") FROM "model_budget";
--> statement-breakpoint
INSERT INTO "model_configuration" ("kind", "id", "workspace_id", "project_id", "name", "created_by", "created_at", "updated_at", "scope_key", "data")
SELECT 'suite', "id", "workspace_id", "project_id", "name", "created_by", "created_at", "updated_at", "id", json_object('description', "description", 'system_prompt', "system_prompt", 'cases', json("cases"), 'grader_ids', json("grader_ids"), 'replay_sample_size', "replay_sample_size") FROM "model_eval_suite";
--> statement-breakpoint
INSERT INTO "model_configuration" ("kind", "id", "workspace_id", "project_id", "name", "revision", "created_by", "created_at", "updated_at", "scope_key", "data")
SELECT 'grader', "id", "workspace_id", "project_id", "name", "revision", "created_by", "created_at", "updated_at", "id", json_object('metric', "metric", 'description', "description", 'config', json("config")) FROM "model_grader";
--> statement-breakpoint
INSERT INTO "model_configuration" ("kind", "id", "workspace_id", "scope_key", "encrypted_secret", "updated_by", "updated_at", "data")
SELECT 'connection', 'connection:' || workspace_id || ':' || provider, "workspace_id", "provider", "encrypted_secret", "updated_by", "updated_at", json_object('account', "account", 'config', json("config"), 'capabilities', json("capabilities")) FROM "workspace_provider_connection";
--> statement-breakpoint
INSERT INTO "model_operation" ("kind", "id", "workspace_id", "project_id", "status", "provider", "provider_ref", "claim_started_at", "output_version_id", "failure_reason", "created_by", "created_at", "started_at", "completed_at", "last_checked_at", "data")
SELECT 'training', "id", "workspace_id", "project_id", "status", "provider", "provider_job_id", "submission_started_at", "output_version_id", "failure_reason", "created_by", "created_at", "started_at", "completed_at", "last_checked_at", json_object('spec', json("spec"), 'spec_hash', "spec_hash", 'trainer', "trainer", 'output_repository', "output_repository", 'dataset_version_ids', json("dataset_version_ids"), 'estimate', json("estimate"), 'cost_usd', "cost_usd", 'compute', json("compute")) FROM "model_training_run";
--> statement-breakpoint
INSERT INTO "model_operation" ("kind", "workspace_id", "id", "suite_id", "evaluation_route_id", "subject_version_id", "trigger", "status", "failure_reason", "created_by", "created_at", "completed_at", "data")
SELECT 'evaluation', (SELECT workspace_id FROM model_eval_suite WHERE id = model_eval_run.suite_id), "id", "suite_id", "route_id", "version_id", "trigger", "status", "failure_reason", "created_by", "created_at", "completed_at", json_object('scores', json("scores"), 'latency_p95_ms', "latency_p95_ms", 'cases_completed', "cases_completed", 'cases_total', "cases_total") FROM "model_eval_run";
--> statement-breakpoint
INSERT INTO "model_operation" ("kind", "id", "workspace_id", "project_id", "name", "version_id", "status", "desired_state", "provider", "provider_ref", "claim_started_at", "route_id", "failure_reason", "created_by", "created_at", "updated_at", "last_checked_at", "billed_until", "data")
SELECT 'deployment', "id", "workspace_id", "project_id", "name", "version_id", "status", "desired_state", "provider", "provider_ref", "provisioning_started_at", "route_id", "failure_reason", "created_by", "created_at", "updated_at", "last_checked_at", "billed_until", json_object('spec', json("spec"), 'spec_hash', "spec_hash", 'host', "host", 'region', "region", 'jurisdiction', "jurisdiction", 'weights_verified', json(CASE WHEN "weights_verified" THEN 'true' ELSE 'false' END), 'hourly_usd', "hourly_usd") FROM "model_deployment";
--> statement-breakpoint
INSERT INTO "model_operation" ("kind", "id", "workspace_id", "name", "status", "failure_reason", "created_by", "created_at", "updated_at", "data")
SELECT 'upload', "id", "workspace_id", "name", "status", "failure_reason", "created_by", "created_at", "updated_at", json_object('purpose', "purpose", 'files', json("files"), 'part_bytes', "part_bytes", 'consumed_by', "consumed_by") FROM "model_upload";
--> statement-breakpoint
INSERT INTO "model_record" ("kind", "id", "version_id", "route_id", "event_kind", "source", "status", "created_at", "data")
SELECT 'evidence', "id", "version_id", "route_id", "kind", "source", "status", "observed_at", json_object('summary', "summary", 'details', json("details")) FROM "model_evidence";
--> statement-breakpoint
INSERT INTO "model_record" ("kind", "id", "configuration_id", "ordinal", "created_by", "created_at", "data")
SELECT 'policy_revision', 'policy-revision:' || policy_id || ':' || revision, "policy_id", "revision", "created_by", "created_at", json_object('hash', "hash", 'rules', json("rules"), 'enforcement', "enforcement") FROM "model_policy_revision";
--> statement-breakpoint
INSERT INTO "model_record" ("kind", "id", "alias_id", "event_kind", "actor_user_id", "created_at", "data")
SELECT 'alias_event', "id", "alias_id", "kind", "actor_user_id", "created_at", json_object('from_route_id', "from_route_id", 'to_route_id', "to_route_id", 'reason', "reason", 'gate', json("gate")) FROM "model_alias_event" ORDER BY rowid;
--> statement-breakpoint
INSERT INTO "model_record" ("kind", "id", "operation_id", "ordinal", "output_version_id", "created_at", "data")
SELECT 'checkpoint', "id", "run_id", "step", "version_id", "created_at", json_object('provider_ref', "provider_ref", 'metrics', json("metrics")) FROM "model_training_checkpoint";
--> statement-breakpoint
INSERT INTO "model_approval" ("kind", "id", "workspace_id", "project_id", "version_id", "route_id", "state", "requested_by", "decided_by", "decided_at", "expires_at", "created_at", "data")
SELECT 'decision', "id", "workspace_id", "project_id", "version_id", "route_id", "state", "requested_by", "decided_by", "decided_at", "expires_at", "created_at", json_object('verdict', json("verdict"), 'evidence_ids', json("evidence_ids"), 'is_exception', json(CASE WHEN "is_exception" THEN 'true' ELSE 'false' END), 'conditions', "conditions", 'note', "note") FROM "model_decision" ORDER BY rowid;
--> statement-breakpoint
INSERT INTO "model_approval" ("kind", "id", "workspace_id", "project_id", "subject_type", "state", "subject_id", "requested_by", "decided_by", "decided_at", "created_at", "data")
SELECT 'spend', "id", "workspace_id", "project_id", "subject_type", "state", "subject_id", "requested_by", "decided_by", "decided_at", "created_at", json_object('payload', json("payload"), 'estimate_usd', "estimate_usd", 'reason', "reason") FROM "model_spend_request";
--> statement-breakpoint
CREATE TABLE "__model_storage_copy_check" ("valid" INTEGER NOT NULL CHECK ("valid" = 1));
--> statement-breakpoint
INSERT INTO "__model_storage_copy_check" SELECT (SELECT count(*) FROM "model_policy") = (SELECT count(*) FROM "model_configuration" WHERE kind = 'policy');
--> statement-breakpoint
INSERT INTO "__model_storage_copy_check" SELECT (SELECT count(*) FROM "model_budget") = (SELECT count(*) FROM "model_configuration" WHERE kind = 'budget');
--> statement-breakpoint
INSERT INTO "__model_storage_copy_check" SELECT (SELECT count(*) FROM "model_eval_suite") = (SELECT count(*) FROM "model_configuration" WHERE kind = 'suite');
--> statement-breakpoint
INSERT INTO "__model_storage_copy_check" SELECT (SELECT count(*) FROM "model_grader") = (SELECT count(*) FROM "model_configuration" WHERE kind = 'grader');
--> statement-breakpoint
INSERT INTO "__model_storage_copy_check" SELECT (SELECT count(*) FROM "workspace_provider_connection") = (SELECT count(*) FROM "model_configuration" WHERE kind = 'connection');
--> statement-breakpoint
INSERT INTO "__model_storage_copy_check" SELECT (SELECT count(*) FROM "model_training_run") = (SELECT count(*) FROM "model_operation" WHERE kind = 'training');
--> statement-breakpoint
INSERT INTO "__model_storage_copy_check" SELECT (SELECT count(*) FROM "model_eval_run") = (SELECT count(*) FROM "model_operation" WHERE kind = 'evaluation');
--> statement-breakpoint
INSERT INTO "__model_storage_copy_check" SELECT (SELECT count(*) FROM "model_deployment") = (SELECT count(*) FROM "model_operation" WHERE kind = 'deployment');
--> statement-breakpoint
INSERT INTO "__model_storage_copy_check" SELECT (SELECT count(*) FROM "model_upload") = (SELECT count(*) FROM "model_operation" WHERE kind = 'upload');
--> statement-breakpoint
INSERT INTO "__model_storage_copy_check" SELECT (SELECT count(*) FROM "model_evidence") = (SELECT count(*) FROM "model_record" WHERE kind = 'evidence');
--> statement-breakpoint
INSERT INTO "__model_storage_copy_check" SELECT (SELECT count(*) FROM "model_policy_revision") = (SELECT count(*) FROM "model_record" WHERE kind = 'policy_revision');
--> statement-breakpoint
INSERT INTO "__model_storage_copy_check" SELECT (SELECT count(*) FROM "model_alias_event") = (SELECT count(*) FROM "model_record" WHERE kind = 'alias_event');
--> statement-breakpoint
INSERT INTO "__model_storage_copy_check" SELECT (SELECT count(*) FROM "model_training_checkpoint") = (SELECT count(*) FROM "model_record" WHERE kind = 'checkpoint');
--> statement-breakpoint
INSERT INTO "__model_storage_copy_check" SELECT (SELECT count(*) FROM "model_decision") = (SELECT count(*) FROM "model_approval" WHERE kind = 'decision');
--> statement-breakpoint
INSERT INTO "__model_storage_copy_check" SELECT (SELECT count(*) FROM "model_spend_request") = (SELECT count(*) FROM "model_approval" WHERE kind = 'spend');
--> statement-breakpoint
DROP TABLE "__model_storage_copy_check";
--> statement-breakpoint
DROP TABLE "model_policy_revision";
--> statement-breakpoint
DROP TABLE "model_eval_run";
--> statement-breakpoint
DROP TABLE "model_training_checkpoint";
--> statement-breakpoint
DROP TABLE "model_policy";
--> statement-breakpoint
DROP TABLE "model_budget";
--> statement-breakpoint
DROP TABLE "model_eval_suite";
--> statement-breakpoint
DROP TABLE "model_grader";
--> statement-breakpoint
DROP TABLE "workspace_provider_connection";
--> statement-breakpoint
DROP TABLE "model_training_run";
--> statement-breakpoint
DROP TABLE "model_deployment";
--> statement-breakpoint
DROP TABLE "model_upload";
--> statement-breakpoint
DROP TABLE "model_evidence";
--> statement-breakpoint
DROP TABLE "model_alias_event";
--> statement-breakpoint
DROP TABLE "model_decision";
--> statement-breakpoint
DROP TABLE "model_spend_request";
