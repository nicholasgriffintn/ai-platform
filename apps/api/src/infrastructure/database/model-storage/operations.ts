import type {
  CostEstimate,
  DeploymentSpec,
  ModificationCompute,
  ScoreSummary,
  TrainingSpec,
  UploadFile,
  DEPLOYMENT_STATUSES,
  JURISDICTIONS,
  MODEL_PROVIDER_IDS,
  TRAINING_RUN_STATUSES,
  UPLOAD_PURPOSES,
} from "@ngriffin_uk/polychat-schemas";
import { sql } from "drizzle-orm";

import { modelConfiguration, modelOperation } from "../schema";
import {
  storageJsonField,
  storageScalarField,
  storageBooleanField,
  storageJsonObject,
  storageJsonPatch,
  type StorageChanges,
  type StorageRecord,
} from "../storage-json";

export type ModelTrainingRunRecord = StorageRecord<typeof modelTrainingRun>;

type ModelTrainingRunInsert = Pick<
  ModelTrainingRunRecord,
  "id" | "workspace_id" | "spec" | "spec_hash" | "provider" | "trainer" | "estimate"
> &
  Partial<
    Pick<
      ModelTrainingRunRecord,
      | "project_id"
      | "status"
      | "provider_job_id"
      | "submission_started_at"
      | "output_repository"
      | "output_version_id"
      | "dataset_version_ids"
      | "cost_usd"
      | "compute"
      | "failure_reason"
      | "created_by"
      | "created_at"
      | "started_at"
      | "completed_at"
      | "last_checked_at"
    >
  >;

export const modelTrainingRun = {
  id: sql<string>`${modelOperation.id}`,
  workspace_id: sql<string>`${modelOperation.workspace_id}`,
  project_id: sql<string | null>`${modelOperation.project_id}`,
  spec: storageJsonField<TrainingSpec>(modelOperation.data, "spec"),
  spec_hash: storageScalarField<string>(modelOperation.data, "spec_hash"),
  status: sql<(typeof TRAINING_RUN_STATUSES)[number]>`${modelOperation.status}`,
  provider: sql<(typeof MODEL_PROVIDER_IDS)[number]>`${modelOperation.provider}`,
  trainer: storageScalarField<string>(modelOperation.data, "trainer"),
  provider_job_id: sql<string | null>`${modelOperation.provider_ref}`,
  submission_started_at: sql<string | null>`${modelOperation.claim_started_at}`,
  output_repository: storageScalarField<string | null>(modelOperation.data, "output_repository"),
  output_version_id: sql<string | null>`${modelOperation.output_version_id}`,
  dataset_version_ids: storageJsonField<string[]>(modelOperation.data, "dataset_version_ids"),
  estimate: storageJsonField<CostEstimate>(modelOperation.data, "estimate"),
  cost_usd: storageScalarField<number | null>(modelOperation.data, "cost_usd"),
  compute: storageJsonField<ModificationCompute | null>(modelOperation.data, "compute"),
  failure_reason: sql<string | null>`${modelOperation.failure_reason}`,
  created_by: sql<number | null>`${modelOperation.created_by}`,
  created_at: sql<string>`${modelOperation.created_at}`,
  started_at: sql<string | null>`${modelOperation.started_at}`,
  completed_at: sql<string | null>`${modelOperation.completed_at}`,
  last_checked_at: sql<string | null>`${modelOperation.last_checked_at}`,
};

export function modelTrainingRunValues(input: ModelTrainingRunInsert) {
  return {
    kind: "training",
    id: input.id,
    workspace_id: input.workspace_id,
    project_id: input.project_id ?? null,
    status: input.status ?? "queued",
    provider: input.provider,
    provider_ref: input.provider_job_id ?? null,
    claim_started_at: input.submission_started_at ?? null,
    output_version_id: input.output_version_id ?? null,
    failure_reason: input.failure_reason ?? null,
    created_by: input.created_by ?? null,
    created_at: input.created_at ?? sql`(CURRENT_TIMESTAMP)`,
    started_at: input.started_at ?? null,
    completed_at: input.completed_at ?? null,
    last_checked_at: input.last_checked_at ?? null,
    data: storageJsonObject({
      spec: input.spec,
      spec_hash: input.spec_hash,
      trainer: input.trainer,
      output_repository: input.output_repository ?? null,
      dataset_version_ids: input.dataset_version_ids ?? [],
      estimate: input.estimate,
      cost_usd: input.cost_usd ?? null,
      compute: input.compute ?? null,
    }),
  };
}

export function modelTrainingRunChanges(input: StorageChanges<ModelTrainingRunRecord>) {
  return {
    id: input.id,
    workspace_id: input.workspace_id,
    project_id: input.project_id,
    status: input.status,
    provider: input.provider,
    provider_ref: input.provider_job_id,
    claim_started_at: input.submission_started_at,
    output_version_id: input.output_version_id,
    failure_reason: input.failure_reason,
    created_by: input.created_by,
    created_at: input.created_at,
    started_at: input.started_at,
    completed_at: input.completed_at,
    last_checked_at: input.last_checked_at,
    data: storageJsonPatch(modelOperation.data, {
      spec: input.spec,
      spec_hash: input.spec_hash,
      trainer: input.trainer,
      output_repository: input.output_repository,
      dataset_version_ids: input.dataset_version_ids,
      estimate: input.estimate,
      cost_usd: input.cost_usd,
      compute: input.compute,
    }),
  };
}

export type ModelEvalRunRecord = StorageRecord<typeof modelEvalRun>;

type ModelEvalRunInsert = Pick<
  ModelEvalRunRecord,
  "id" | "suite_id" | "route_id" | "version_id" | "trigger" | "cases_total"
> &
  Partial<
    Pick<
      ModelEvalRunRecord,
      | "status"
      | "scores"
      | "latency_p95_ms"
      | "cases_completed"
      | "failure_reason"
      | "created_by"
      | "created_at"
      | "completed_at"
    >
  >;

export const modelEvalRun = {
  id: sql<string>`${modelOperation.id}`,
  suite_id: sql<string>`${modelOperation.suite_id}`,
  route_id: sql<string>`${modelOperation.evaluation_route_id}`,
  version_id: sql<string>`${modelOperation.subject_version_id}`,
  trigger: sql<
    "manual" | "deployment" | "checkpoint" | "promotion" | "replay"
  >`${modelOperation.trigger}`,
  status: sql<"queued" | "running" | "completed" | "failed">`${modelOperation.status}`,
  scores: storageJsonField<Record<string, ScoreSummary>>(modelOperation.data, "scores"),
  latency_p95_ms: storageScalarField<number | null>(modelOperation.data, "latency_p95_ms"),
  cases_completed: storageScalarField<number>(modelOperation.data, "cases_completed"),
  cases_total: storageScalarField<number>(modelOperation.data, "cases_total"),
  failure_reason: sql<string | null>`${modelOperation.failure_reason}`,
  created_by: sql<number | null>`${modelOperation.created_by}`,
  created_at: sql<string>`${modelOperation.created_at}`,
  completed_at: sql<string | null>`${modelOperation.completed_at}`,
};

export function modelEvalRunValues(input: ModelEvalRunInsert) {
  return {
    kind: "evaluation",
    workspace_id: sql`(SELECT workspace_id FROM ${modelConfiguration} WHERE ${modelConfiguration.id} = ${input.suite_id} AND ${modelConfiguration.kind} = 'suite')`,
    id: input.id,
    suite_id: input.suite_id,
    evaluation_route_id: input.route_id,
    subject_version_id: input.version_id,
    trigger: input.trigger,
    status: input.status ?? "queued",
    failure_reason: input.failure_reason ?? null,
    created_by: input.created_by ?? null,
    created_at: input.created_at ?? sql`(CURRENT_TIMESTAMP)`,
    completed_at: input.completed_at ?? null,
    data: storageJsonObject({
      scores: input.scores ?? {},
      latency_p95_ms: input.latency_p95_ms ?? null,
      cases_completed: input.cases_completed ?? 0,
      cases_total: input.cases_total,
    }),
  };
}

export function modelEvalRunChanges(input: StorageChanges<ModelEvalRunRecord>) {
  return {
    id: input.id,
    suite_id: input.suite_id,
    evaluation_route_id: input.route_id,
    subject_version_id: input.version_id,
    trigger: input.trigger,
    status: input.status,
    failure_reason: input.failure_reason,
    created_by: input.created_by,
    created_at: input.created_at,
    completed_at: input.completed_at,
    data: storageJsonPatch(modelOperation.data, {
      scores: input.scores,
      latency_p95_ms: input.latency_p95_ms,
      cases_completed: input.cases_completed,
      cases_total: input.cases_total,
    }),
  };
}

export type ModelDeploymentRecord = StorageRecord<typeof modelDeployment>;

type ModelDeploymentInsert = Pick<
  ModelDeploymentRecord,
  "id" | "workspace_id" | "name" | "version_id" | "spec" | "spec_hash" | "provider" | "host"
> &
  Partial<
    Pick<
      ModelDeploymentRecord,
      | "project_id"
      | "status"
      | "desired_state"
      | "provider_ref"
      | "provisioning_started_at"
      | "region"
      | "jurisdiction"
      | "weights_verified"
      | "route_id"
      | "hourly_usd"
      | "failure_reason"
      | "created_by"
      | "created_at"
      | "updated_at"
      | "last_checked_at"
      | "billed_until"
    >
  >;

export const modelDeployment = {
  id: sql<string>`${modelOperation.id}`,
  workspace_id: sql<string>`${modelOperation.workspace_id}`,
  project_id: sql<string | null>`${modelOperation.project_id}`,
  name: sql<string>`${modelOperation.name}`,
  version_id: sql<string>`${modelOperation.version_id}`,
  spec: storageJsonField<DeploymentSpec>(modelOperation.data, "spec"),
  spec_hash: storageScalarField<string>(modelOperation.data, "spec_hash"),
  status: sql<(typeof DEPLOYMENT_STATUSES)[number]>`${modelOperation.status}`,
  desired_state: sql<"running" | "paused" | "deleted">`${modelOperation.desired_state}`,
  provider: sql<(typeof MODEL_PROVIDER_IDS)[number]>`${modelOperation.provider}`,
  host: storageScalarField<string>(modelOperation.data, "host"),
  provider_ref: sql<string | null>`${modelOperation.provider_ref}`,
  provisioning_started_at: sql<string | null>`${modelOperation.claim_started_at}`,
  region: storageScalarField<string | null>(modelOperation.data, "region"),
  jurisdiction: storageJsonField<(typeof JURISDICTIONS)[number] | null>(
    modelOperation.data,
    "jurisdiction",
  ),
  weights_verified: storageBooleanField(modelOperation.data, "weights_verified"),
  route_id: sql<string | null>`${modelOperation.route_id}`,
  hourly_usd: storageScalarField<number | null>(modelOperation.data, "hourly_usd"),
  failure_reason: sql<string | null>`${modelOperation.failure_reason}`,
  created_by: sql<number | null>`${modelOperation.created_by}`,
  created_at: sql<string>`${modelOperation.created_at}`,
  updated_at: sql<string>`${modelOperation.updated_at}`,
  last_checked_at: sql<string | null>`${modelOperation.last_checked_at}`,
  billed_until: sql<string | null>`${modelOperation.billed_until}`,
};

export function modelDeploymentValues(input: ModelDeploymentInsert) {
  return {
    kind: "deployment",
    id: input.id,
    workspace_id: input.workspace_id,
    project_id: input.project_id ?? null,
    name: input.name,
    version_id: input.version_id,
    status: input.status ?? "pending",
    desired_state: input.desired_state ?? "running",
    provider: input.provider,
    provider_ref: input.provider_ref ?? null,
    claim_started_at: input.provisioning_started_at ?? null,
    route_id: input.route_id ?? null,
    failure_reason: input.failure_reason ?? null,
    created_by: input.created_by ?? null,
    created_at: input.created_at ?? sql`(CURRENT_TIMESTAMP)`,
    updated_at: input.updated_at ?? sql`(CURRENT_TIMESTAMP)`,
    last_checked_at: input.last_checked_at ?? null,
    billed_until: input.billed_until ?? null,
    data: storageJsonObject({
      spec: input.spec,
      spec_hash: input.spec_hash,
      host: input.host,
      region: input.region ?? null,
      jurisdiction: input.jurisdiction ?? null,
      weights_verified: input.weights_verified ?? false,
      hourly_usd: input.hourly_usd ?? null,
    }),
  };
}

export function modelDeploymentChanges(input: StorageChanges<ModelDeploymentRecord>) {
  return {
    id: input.id,
    workspace_id: input.workspace_id,
    project_id: input.project_id,
    name: input.name,
    version_id: input.version_id,
    status: input.status,
    desired_state: input.desired_state,
    provider: input.provider,
    provider_ref: input.provider_ref,
    claim_started_at: input.provisioning_started_at,
    route_id: input.route_id,
    failure_reason: input.failure_reason,
    created_by: input.created_by,
    created_at: input.created_at,
    updated_at: input.updated_at,
    last_checked_at: input.last_checked_at,
    billed_until: input.billed_until,
    data: storageJsonPatch(modelOperation.data, {
      spec: input.spec,
      spec_hash: input.spec_hash,
      host: input.host,
      region: input.region,
      jurisdiction: input.jurisdiction,
      weights_verified: input.weights_verified,
      hourly_usd: input.hourly_usd,
    }),
  };
}

export type ModelUploadRecord = StorageRecord<typeof modelUpload>;

type ModelUploadInsert = Pick<
  ModelUploadRecord,
  "id" | "workspace_id" | "purpose" | "name" | "files" | "part_bytes"
> &
  Partial<
    Pick<
      ModelUploadRecord,
      "status" | "failure_reason" | "consumed_by" | "created_by" | "created_at" | "updated_at"
    >
  >;

export const modelUpload = {
  id: sql<string>`${modelOperation.id}`,
  workspace_id: sql<string>`${modelOperation.workspace_id}`,
  purpose: storageScalarField<(typeof UPLOAD_PURPOSES)[number]>(modelOperation.data, "purpose"),
  name: sql<string>`${modelOperation.name}`,
  status: sql<"uploading" | "hashing" | "ready" | "failed" | "aborted">`${modelOperation.status}`,
  files: storageJsonField<
    Array<UploadFile & { key: string; multipartId: string; etags: Record<string, string> }>
  >(modelOperation.data, "files"),
  part_bytes: storageScalarField<number>(modelOperation.data, "part_bytes"),
  failure_reason: sql<string | null>`${modelOperation.failure_reason}`,
  consumed_by: storageScalarField<string | null>(modelOperation.data, "consumed_by"),
  created_by: sql<number | null>`${modelOperation.created_by}`,
  created_at: sql<string>`${modelOperation.created_at}`,
  updated_at: sql<string>`${modelOperation.updated_at}`,
};

export function modelUploadValues(input: ModelUploadInsert) {
  return {
    kind: "upload",
    id: input.id,
    workspace_id: input.workspace_id,
    name: input.name,
    status: input.status ?? "uploading",
    failure_reason: input.failure_reason ?? null,
    created_by: input.created_by ?? null,
    created_at: input.created_at ?? sql`(CURRENT_TIMESTAMP)`,
    updated_at: input.updated_at ?? sql`(CURRENT_TIMESTAMP)`,
    data: storageJsonObject({
      purpose: input.purpose,
      files: input.files,
      part_bytes: input.part_bytes,
      consumed_by: input.consumed_by ?? null,
    }),
  };
}

export function modelUploadChanges(input: StorageChanges<ModelUploadRecord>) {
  return {
    id: input.id,
    workspace_id: input.workspace_id,
    name: input.name,
    status: input.status,
    failure_reason: input.failure_reason,
    created_by: input.created_by,
    created_at: input.created_at,
    updated_at: input.updated_at,
    data: storageJsonPatch(modelOperation.data, {
      purpose: input.purpose,
      files: input.files,
      part_bytes: input.part_bytes,
      consumed_by: input.consumed_by,
    }),
  };
}
