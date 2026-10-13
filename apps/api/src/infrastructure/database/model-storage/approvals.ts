import type { PolicyVerdict, SPEND_REQUEST_STATES } from "@ngriffin_uk/polychat-schemas";
import { sql } from "drizzle-orm";

import { approval } from "../schema";
import {
  storageJsonField,
  storageScalarField,
  storageBooleanField,
  storageJsonObject,
  storageJsonPatch,
  type StorageChanges,
  type StorageRecord,
} from "../storage-json";

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
  id: sql<string>`${approval.id}`,
  workspace_id: sql<string>`${approval.workspace_id}`,
  project_id: sql<string | null>`${approval.project_id}`,
  version_id: sql<string>`${approval.version_id}`,
  route_id: sql<string | null>`${approval.route_id}`,
  state: sql<"pending" | "approved" | "rejected" | "revoked" | "expired">`${approval.state}`,
  verdict: storageJsonField<PolicyVerdict>(approval.data, "verdict"),
  evidence_ids: storageJsonField<string[]>(approval.data, "evidence_ids"),
  is_exception: storageBooleanField(approval.data, "is_exception"),
  conditions: storageScalarField<string | null>(approval.data, "conditions"),
  note: storageScalarField<string | null>(approval.data, "note"),
  requested_by: sql<number | null>`${approval.requested_by}`,
  decided_by: sql<number | null>`${approval.decided_by}`,
  decided_at: sql<string | null>`${approval.decided_at}`,
  expires_at: sql<string | null>`${approval.expires_at}`,
  created_at: sql<string>`${approval.created_at}`,
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
    data: storageJsonPatch(approval.data, {
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
  id: sql<string>`${approval.id}`,
  workspace_id: sql<string>`${approval.workspace_id}`,
  project_id: sql<string | null>`${approval.project_id}`,
  subject_type: sql<"training_run" | "deployment">`${approval.subject_type}`,
  payload: storageJsonField<Record<string, unknown>>(approval.data, "payload"),
  estimate_usd: storageScalarField<number | null>(approval.data, "estimate_usd"),
  reason: storageScalarField<string | null>(approval.data, "reason"),
  state: sql<(typeof SPEND_REQUEST_STATES)[number]>`${approval.state}`,
  subject_id: sql<string | null>`${approval.subject_id}`,
  requested_by: sql<number | null>`${approval.requested_by}`,
  decided_by: sql<number | null>`${approval.decided_by}`,
  decided_at: sql<string | null>`${approval.decided_at}`,
  created_at: sql<string>`${approval.created_at}`,
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
    data: storageJsonPatch(approval.data, {
      payload: input.payload,
      estimate_usd: input.estimate_usd,
      reason: input.reason,
    }),
  };
}
