import type { PolicyVerdict, SPEND_REQUEST_STATES } from "@ngriffin_uk/polychat-schemas";
import { sql } from "drizzle-orm";

import {
  storageJsonField,
  storageScalarField,
  storageBooleanField,
  storageJsonObject,
  storageJsonPatch,
  type StorageChanges,
  type StorageRecord,
} from "../model-storage-json";
import { modelApproval } from "../schema";

export type ModelDecisionRecord = StorageRecord<typeof modelDecision>;

type ModelDecisionInsert = Pick<
  ModelDecisionRecord,
  "id" | "workspace_id" | "version_id" | "verdict"
> &
  Partial<
    Pick<
      ModelDecisionRecord,
      | "project_id"
      | "route_id"
      | "state"
      | "evidence_ids"
      | "is_exception"
      | "conditions"
      | "note"
      | "requested_by"
      | "decided_by"
      | "decided_at"
      | "expires_at"
      | "created_at"
    >
  >;

export const modelDecision = {
  id: sql<string>`${modelApproval.id}`,
  workspace_id: sql<string>`${modelApproval.workspace_id}`,
  project_id: sql<string | null>`${modelApproval.project_id}`,
  version_id: sql<string>`${modelApproval.version_id}`,
  route_id: sql<string | null>`${modelApproval.route_id}`,
  state: sql<"pending" | "approved" | "rejected" | "revoked" | "expired">`${modelApproval.state}`,
  verdict: storageJsonField<PolicyVerdict>(modelApproval.data, "verdict"),
  evidence_ids: storageJsonField<string[]>(modelApproval.data, "evidence_ids"),
  is_exception: storageBooleanField(modelApproval.data, "is_exception"),
  conditions: storageScalarField<string | null>(modelApproval.data, "conditions"),
  note: storageScalarField<string | null>(modelApproval.data, "note"),
  requested_by: sql<number | null>`${modelApproval.requested_by}`,
  decided_by: sql<number | null>`${modelApproval.decided_by}`,
  decided_at: sql<string | null>`${modelApproval.decided_at}`,
  expires_at: sql<string | null>`${modelApproval.expires_at}`,
  created_at: sql<string>`${modelApproval.created_at}`,
};

export function modelDecisionValues(input: ModelDecisionInsert) {
  return {
    kind: "decision",
    id: input.id,
    workspace_id: input.workspace_id,
    project_id: input.project_id ?? null,
    version_id: input.version_id,
    route_id: input.route_id ?? null,
    state: input.state ?? "pending",
    requested_by: input.requested_by ?? null,
    decided_by: input.decided_by ?? null,
    decided_at: input.decided_at ?? null,
    expires_at: input.expires_at ?? null,
    created_at: input.created_at ?? sql`(CURRENT_TIMESTAMP)`,
    data: storageJsonObject({
      verdict: input.verdict,
      evidence_ids: input.evidence_ids ?? [],
      is_exception: input.is_exception ?? false,
      conditions: input.conditions ?? null,
      note: input.note ?? null,
    }),
  };
}

export function modelDecisionChanges(input: StorageChanges<ModelDecisionRecord>) {
  return {
    id: input.id,
    workspace_id: input.workspace_id,
    project_id: input.project_id,
    version_id: input.version_id,
    route_id: input.route_id,
    state: input.state,
    requested_by: input.requested_by,
    decided_by: input.decided_by,
    decided_at: input.decided_at,
    expires_at: input.expires_at,
    created_at: input.created_at,
    data: storageJsonPatch(modelApproval.data, {
      verdict: input.verdict,
      evidence_ids: input.evidence_ids,
      is_exception: input.is_exception,
      conditions: input.conditions,
      note: input.note,
    }),
  };
}

export type ModelSpendRequestRecord = StorageRecord<typeof modelSpendRequest>;

type ModelSpendRequestInsert = Pick<
  ModelSpendRequestRecord,
  "id" | "workspace_id" | "subject_type" | "payload"
> &
  Partial<
    Pick<
      ModelSpendRequestRecord,
      | "project_id"
      | "estimate_usd"
      | "reason"
      | "state"
      | "subject_id"
      | "requested_by"
      | "decided_by"
      | "decided_at"
      | "created_at"
    >
  >;

export const modelSpendRequest = {
  id: sql<string>`${modelApproval.id}`,
  workspace_id: sql<string>`${modelApproval.workspace_id}`,
  project_id: sql<string | null>`${modelApproval.project_id}`,
  subject_type: sql<"training_run" | "deployment">`${modelApproval.subject_type}`,
  payload: storageJsonField<Record<string, unknown>>(modelApproval.data, "payload"),
  estimate_usd: storageScalarField<number | null>(modelApproval.data, "estimate_usd"),
  reason: storageScalarField<string | null>(modelApproval.data, "reason"),
  state: sql<(typeof SPEND_REQUEST_STATES)[number]>`${modelApproval.state}`,
  subject_id: sql<string | null>`${modelApproval.subject_id}`,
  requested_by: sql<number | null>`${modelApproval.requested_by}`,
  decided_by: sql<number | null>`${modelApproval.decided_by}`,
  decided_at: sql<string | null>`${modelApproval.decided_at}`,
  created_at: sql<string>`${modelApproval.created_at}`,
};

export function modelSpendRequestValues(input: ModelSpendRequestInsert) {
  return {
    kind: "spend",
    id: input.id,
    workspace_id: input.workspace_id,
    project_id: input.project_id ?? null,
    subject_type: input.subject_type,
    state: input.state ?? "pending",
    subject_id: input.subject_id ?? null,
    requested_by: input.requested_by ?? null,
    decided_by: input.decided_by ?? null,
    decided_at: input.decided_at ?? null,
    created_at: input.created_at ?? sql`(CURRENT_TIMESTAMP)`,
    data: storageJsonObject({
      payload: input.payload,
      estimate_usd: input.estimate_usd ?? null,
      reason: input.reason ?? null,
    }),
  };
}

export function modelSpendRequestChanges(input: StorageChanges<ModelSpendRequestRecord>) {
  return {
    id: input.id,
    workspace_id: input.workspace_id,
    project_id: input.project_id,
    subject_type: input.subject_type,
    state: input.state,
    subject_id: input.subject_id,
    requested_by: input.requested_by,
    decided_by: input.decided_by,
    decided_at: input.decided_at,
    created_at: input.created_at,
    data: storageJsonPatch(modelApproval.data, {
      payload: input.payload,
      estimate_usd: input.estimate_usd,
      reason: input.reason,
    }),
  };
}
