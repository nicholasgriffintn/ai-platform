import type {
  PolicyRule,
  ALIAS_EVENT_KINDS,
  EVIDENCE_KINDS,
  EVIDENCE_SOURCES,
  EVIDENCE_STATUSES,
} from "@ngriffin_uk/polychat-schemas";
import { sql } from "drizzle-orm";

import { modelRecord } from "../schema";
import {
  storageJsonField,
  storageScalarField,
  storageJsonObject,
  storageJsonPatch,
  type StorageChanges,
  type StorageRecord,
} from "../storage-json";

export type ModelEvidenceRecord = StorageRecord<typeof modelEvidence>;

type ModelEvidenceInsert = Pick<
  ModelEvidenceRecord,
  "id" | "version_id" | "kind" | "source" | "status" | "summary"
> &
  Partial<Pick<ModelEvidenceRecord, "route_id" | "details" | "observed_at">>;

export const modelEvidence = {
  id: sql<string>`${modelRecord.id}`,
  version_id: sql<string>`${modelRecord.version_id}`,
  route_id: sql<string | null>`${modelRecord.route_id}`,
  kind: sql<(typeof EVIDENCE_KINDS)[number]>`${modelRecord.event_kind}`,
  source: sql<(typeof EVIDENCE_SOURCES)[number]>`${modelRecord.source}`,
  status: sql<(typeof EVIDENCE_STATUSES)[number]>`${modelRecord.status}`,
  summary: storageScalarField<string>(modelRecord.data, "summary"),
  details: storageJsonField<Record<string, unknown>>(modelRecord.data, "details"),
  observed_at: sql<string>`${modelRecord.created_at}`,
};

export function modelEvidenceValues(input: ModelEvidenceInsert) {
  return {
    kind: "evidence",
    id: input.id,
    version_id: input.version_id,
    route_id: input.route_id ?? null,
    event_kind: input.kind,
    source: input.source,
    status: input.status,
    created_at: input.observed_at ?? sql`(CURRENT_TIMESTAMP)`,
    data: storageJsonObject({
      summary: input.summary,
      details: input.details ?? {},
    }),
  };
}

export type ModelPolicyRevisionRecord = StorageRecord<typeof modelPolicyRevision>;

type ModelPolicyRevisionInsert = Pick<
  ModelPolicyRevisionRecord,
  "policy_id" | "revision" | "hash" | "rules" | "enforcement"
> &
  Partial<Pick<ModelPolicyRevisionRecord, "created_by" | "created_at">>;

export const modelPolicyRevision = {
  policy_id: sql<string>`${modelRecord.configuration_id}`,
  revision: sql<number>`${modelRecord.ordinal}`,
  hash: storageScalarField<string>(modelRecord.data, "hash"),
  rules: storageJsonField<PolicyRule[]>(modelRecord.data, "rules"),
  enforcement: storageScalarField<"advisory" | "enforced">(modelRecord.data, "enforcement"),
  created_by: sql<number | null>`${modelRecord.created_by}`,
  created_at: sql<string>`${modelRecord.created_at}`,
};

export function modelPolicyRevisionValues(input: ModelPolicyRevisionInsert) {
  return {
    kind: "policy_revision",
    id: `policy-revision:${input.policy_id}:${input.revision}`,
    configuration_id: input.policy_id,
    ordinal: input.revision,
    created_by: input.created_by ?? null,
    created_at: input.created_at ?? sql`(CURRENT_TIMESTAMP)`,
    data: storageJsonObject({
      hash: input.hash,
      rules: input.rules,
      enforcement: input.enforcement,
    }),
  };
}

export type ModelAliasEventRecord = StorageRecord<typeof modelAliasEvent>;

type ModelAliasEventInsert = Pick<ModelAliasEventRecord, "id" | "alias_id" | "kind"> &
  Partial<
    Pick<
      ModelAliasEventRecord,
      "from_route_id" | "to_route_id" | "reason" | "gate" | "actor_user_id" | "created_at"
    >
  >;

export const modelAliasEvent = {
  id: sql<string>`${modelRecord.id}`,
  alias_id: sql<string>`${modelRecord.alias_id}`,
  kind: sql<(typeof ALIAS_EVENT_KINDS)[number]>`${modelRecord.event_kind}`,
  from_route_id: storageScalarField<string | null>(modelRecord.data, "from_route_id"),
  to_route_id: storageScalarField<string | null>(modelRecord.data, "to_route_id"),
  reason: storageScalarField<string | null>(modelRecord.data, "reason"),
  gate: storageJsonField<{
    passed: boolean;
    scores: Record<string, number>;
    failures: string[];
    runId: string | null;
  } | null>(modelRecord.data, "gate"),
  actor_user_id: sql<number | null>`${modelRecord.actor_user_id}`,
  created_at: sql<string>`${modelRecord.created_at}`,
};

export function modelAliasEventValues(input: ModelAliasEventInsert) {
  return {
    kind: "alias_event",
    id: input.id,
    alias_id: input.alias_id,
    event_kind: input.kind,
    actor_user_id: input.actor_user_id ?? null,
    created_at: input.created_at ?? sql`(CURRENT_TIMESTAMP)`,
    data: storageJsonObject({
      from_route_id: input.from_route_id ?? null,
      to_route_id: input.to_route_id ?? null,
      reason: input.reason ?? null,
      gate: input.gate ?? null,
    }),
  };
}

export type ModelTrainingCheckpointRecord = StorageRecord<typeof modelTrainingCheckpoint>;

type ModelTrainingCheckpointInsert = Pick<
  ModelTrainingCheckpointRecord,
  "id" | "run_id" | "step" | "provider_ref"
> &
  Partial<Pick<ModelTrainingCheckpointRecord, "version_id" | "metrics" | "created_at">>;

export const modelTrainingCheckpoint = {
  id: sql<string>`${modelRecord.id}`,
  run_id: sql<string>`${modelRecord.operation_id}`,
  step: sql<number>`${modelRecord.ordinal}`,
  provider_ref: storageScalarField<string>(modelRecord.data, "provider_ref"),
  version_id: sql<string | null>`${modelRecord.output_version_id}`,
  metrics: storageJsonField<Record<string, number>>(modelRecord.data, "metrics"),
  created_at: sql<string>`${modelRecord.created_at}`,
};

export function modelTrainingCheckpointValues(input: ModelTrainingCheckpointInsert) {
  return {
    kind: "checkpoint",
    id: input.id,
    operation_id: input.run_id,
    ordinal: input.step,
    output_version_id: input.version_id ?? null,
    created_at: input.created_at ?? sql`(CURRENT_TIMESTAMP)`,
    data: storageJsonObject({
      provider_ref: input.provider_ref,
      metrics: input.metrics ?? {},
    }),
  };
}

export function modelTrainingCheckpointChanges(
  input: StorageChanges<ModelTrainingCheckpointRecord>,
) {
  return {
    id: input.id,
    operation_id: input.run_id,
    ordinal: input.step,
    output_version_id: input.version_id,
    created_at: input.created_at,
    data: storageJsonPatch(modelRecord.data, {
      provider_ref: input.provider_ref,
      metrics: input.metrics,
    }),
  };
}
