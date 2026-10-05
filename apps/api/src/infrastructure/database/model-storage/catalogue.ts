import type {
  AliasGate,
  COST_SUBJECTS,
  MODEL_ASSET_KINDS,
  MODEL_ASSET_SOURCES,
  MODEL_PROVIDER_IDS,
  JURISDICTIONS,
} from "@ngriffin_uk/polychat-schemas";
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
import { modelConfiguration, modelRecord } from "../schema";

export type ModelAssetRecord = StorageRecord<typeof modelAsset>;

type ModelAssetInsert = Pick<
  ModelAssetRecord,
  "id" | "workspace_id" | "kind" | "source" | "source_ref" | "display_name"
> &
  Partial<Pick<ModelAssetRecord, "created_by" | "created_at">>;

export const modelAsset = {
  id: sql<string>`${modelConfiguration.id}`,
  workspace_id: sql<string>`${modelConfiguration.workspace_id}`,
  kind: sql<(typeof MODEL_ASSET_KINDS)[number]>`${modelConfiguration.asset_type}`,
  source: sql<(typeof MODEL_ASSET_SOURCES)[number]>`${modelConfiguration.source}`,
  source_ref: sql<string>`${modelConfiguration.source_ref}`,
  display_name: sql<string>`${modelConfiguration.name}`,
  created_by: sql<number | null>`${modelConfiguration.created_by}`,
  created_at: sql<string>`${modelConfiguration.created_at}`,
};

export function modelAssetValues(input: ModelAssetInsert) {
  return {
    kind: "asset",
    id: input.id,
    workspace_id: input.workspace_id,
    asset_type: input.kind,
    source: input.source,
    source_ref: input.source_ref,
    name: input.display_name,
    created_by: input.created_by ?? null,
    created_at: input.created_at ?? sql`(CURRENT_TIMESTAMP)`,
    scope_key: input.id,
    data: storageJsonObject({}),
  };
}

export type ModelRouteRecord = StorageRecord<typeof modelRoute>;

type ModelRouteInsert = Pick<
  ModelRouteRecord,
  "id" | "workspace_id" | "version_id" | "provider" | "provider_model_id" | "region"
> &
  Partial<
    Pick<
      ModelRouteRecord,
      | "weights_verified"
      | "status"
      | "deployment_id"
      | "jurisdiction"
      | "retention"
      | "created_by"
      | "created_at"
    >
  >;

export const modelRoute = {
  id: sql<string>`${modelConfiguration.id}`,
  workspace_id: sql<string>`${modelConfiguration.workspace_id}`,
  version_id: sql<string>`${modelConfiguration.version_id}`,
  provider: sql<string>`${modelConfiguration.provider}`,
  provider_model_id: sql<string>`${modelConfiguration.provider_model_id}`,
  region: storageScalarField<string>(modelConfiguration.data, "region"),
  weights_verified: storageBooleanField(modelConfiguration.data, "weights_verified"),
  status: sql<"active" | "retired">`${modelConfiguration.status}`,
  deployment_id: storageScalarField<string | null>(modelConfiguration.data, "deployment_id"),
  jurisdiction: storageScalarField<(typeof JURISDICTIONS)[number] | null>(
    modelConfiguration.data,
    "jurisdiction",
  ),
  retention: storageScalarField<"zero" | "provider" | "self" | null>(
    modelConfiguration.data,
    "retention",
  ),
  created_by: sql<number | null>`${modelConfiguration.created_by}`,
  created_at: sql<string>`${modelConfiguration.created_at}`,
};

export function modelRouteValues(input: ModelRouteInsert) {
  return {
    kind: "route",
    id: input.id,
    workspace_id: input.workspace_id,
    version_id: input.version_id,
    provider: input.provider,
    provider_model_id: input.provider_model_id,
    status: input.status ?? "active",
    created_by: input.created_by ?? null,
    created_at: input.created_at ?? sql`(CURRENT_TIMESTAMP)`,
    scope_key: input.id,
    data: storageJsonObject({
      region: input.region,
      weights_verified: input.weights_verified ?? false,
      deployment_id: input.deployment_id ?? null,
      jurisdiction: input.jurisdiction ?? null,
      retention: input.retention ?? null,
    }),
  };
}

export function modelRouteChanges(input: StorageChanges<ModelRouteRecord>) {
  return {
    id: input.id,
    workspace_id: input.workspace_id,
    version_id: input.version_id,
    provider: input.provider,
    provider_model_id: input.provider_model_id,
    status: input.status,
    created_by: input.created_by,
    created_at: input.created_at,
    data: storageJsonPatch(modelConfiguration.data, {
      region: input.region,
      weights_verified: input.weights_verified,
      deployment_id: input.deployment_id,
      jurisdiction: input.jurisdiction,
      retention: input.retention,
    }),
  };
}

export type ModelAliasRecord = StorageRecord<typeof modelAlias>;

type ModelAliasInsert = Pick<ModelAliasRecord, "id" | "workspace_id" | "scope_key" | "name"> &
  Partial<
    Pick<
      ModelAliasRecord,
      | "project_id"
      | "description"
      | "route_id"
      | "canary_route_id"
      | "canary_percent"
      | "gate"
      | "requires_approval"
      | "updated_by"
      | "updated_at"
      | "created_at"
    >
  >;

export const modelAlias = {
  id: sql<string>`${modelConfiguration.id}`,
  workspace_id: sql<string>`${modelConfiguration.workspace_id}`,
  project_id: sql<string | null>`${modelConfiguration.project_id}`,
  scope_key: sql<string>`${modelConfiguration.scope_key}`,
  name: sql<string>`${modelConfiguration.name}`,
  description: storageScalarField<string | null>(modelConfiguration.data, "description"),
  route_id: sql<string | null>`${modelConfiguration.route_id}`,
  canary_route_id: sql<string | null>`${modelConfiguration.canary_route_id}`,
  canary_percent: storageScalarField<number>(modelConfiguration.data, "canary_percent"),
  gate: storageJsonField<AliasGate | null>(modelConfiguration.data, "gate"),
  requires_approval: storageBooleanField(modelConfiguration.data, "requires_approval"),
  updated_by: sql<number | null>`${modelConfiguration.updated_by}`,
  updated_at: sql<string>`${modelConfiguration.updated_at}`,
  created_at: sql<string>`${modelConfiguration.created_at}`,
};

export function modelAliasValues(input: ModelAliasInsert) {
  return {
    kind: "alias",
    route_kind: input.route_id == null ? null : "route",
    canary_route_kind: input.canary_route_id == null ? null : "route",
    id: input.id,
    workspace_id: input.workspace_id,
    project_id: input.project_id ?? null,
    scope_key: input.scope_key,
    name: input.name,
    route_id: input.route_id ?? null,
    canary_route_id: input.canary_route_id ?? null,
    updated_by: input.updated_by ?? null,
    updated_at: input.updated_at ?? sql`(CURRENT_TIMESTAMP)`,
    created_at: input.created_at ?? sql`(CURRENT_TIMESTAMP)`,
    data: storageJsonObject({
      description: input.description ?? null,
      canary_percent: input.canary_percent ?? 0,
      gate: input.gate ?? null,
      requires_approval: input.requires_approval ?? false,
    }),
  };
}

export function modelAliasChanges(input: StorageChanges<ModelAliasRecord>) {
  return {
    route_kind: input.route_id === undefined ? undefined : input.route_id === null ? null : "route",
    canary_route_kind:
      input.canary_route_id === undefined
        ? undefined
        : input.canary_route_id === null
          ? null
          : "route",
    id: input.id,
    workspace_id: input.workspace_id,
    project_id: input.project_id,
    scope_key: input.scope_key,
    name: input.name,
    route_id: input.route_id,
    canary_route_id: input.canary_route_id,
    updated_by: input.updated_by,
    updated_at: input.updated_at,
    created_at: input.created_at,
    data: storageJsonPatch(modelConfiguration.data, {
      description: input.description,
      canary_percent: input.canary_percent,
      gate: input.gate,
      requires_approval: input.requires_approval,
    }),
  };
}

export type ModelAssetFileRecord = StorageRecord<typeof modelAssetFile>;

type ModelAssetFileInsert = Pick<ModelAssetFileRecord, "version_id" | "path" | "size"> &
  Partial<Pick<ModelAssetFileRecord, "sha256" | "format">>;

export const modelAssetFile = {
  version_id: sql<string>`${modelRecord.version_id}`,
  path: sql<string>`${modelRecord.path}`,
  size: storageScalarField<number>(modelRecord.data, "size"),
  sha256: storageScalarField<string | null>(modelRecord.data, "sha256"),
  format: storageScalarField<string | null>(modelRecord.data, "format"),
};

export function modelAssetFileValues(input: ModelAssetFileInsert) {
  return {
    kind: "file",
    id: JSON.stringify([input.version_id, input.path]),
    version_id: input.version_id,
    path: input.path,
    data: storageJsonObject({
      size: input.size,
      sha256: input.sha256 ?? null,
      format: input.format ?? null,
    }),
  };
}

export type ModelCostEntryRecord = StorageRecord<typeof modelCostEntry>;

type ModelCostEntryInsert = Pick<
  ModelCostEntryRecord,
  | "id"
  | "workspace_id"
  | "subject_type"
  | "subject_id"
  | "provider"
  | "usd"
  | "basis"
  | "period_start"
  | "period_end"
> &
  Partial<Pick<ModelCostEntryRecord, "project_id" | "created_at">>;

export const modelCostEntry = {
  id: sql<string>`${modelRecord.id}`,
  workspace_id: sql<string>`${modelRecord.workspace_id}`,
  project_id: sql<string | null>`${modelRecord.project_id}`,
  subject_type: sql<(typeof COST_SUBJECTS)[number]>`${modelRecord.subject_type}`,
  subject_id: sql<string>`${modelRecord.subject_id}`,
  provider: sql<(typeof MODEL_PROVIDER_IDS)[number]>`${modelRecord.provider}`,
  usd: sql<number>`${modelRecord.usd}`,
  basis: storageScalarField<"estimate" | "reported" | "metered">(modelRecord.data, "basis"),
  period_start: sql<string>`${modelRecord.period_start}`,
  period_end: sql<string>`${modelRecord.period_end}`,
  created_at: sql<string>`${modelRecord.created_at}`,
};

export function modelCostEntryValues(input: ModelCostEntryInsert) {
  return {
    kind: "cost",
    id: input.id,
    workspace_id: input.workspace_id,
    project_id: input.project_id ?? null,
    subject_type: input.subject_type,
    subject_id: input.subject_id,
    provider: input.provider,
    usd: input.usd,
    period_start: input.period_start,
    period_end: input.period_end,
    created_at: input.created_at ?? sql`(CURRENT_TIMESTAMP)`,
    data: storageJsonObject({
      basis: input.basis,
    }),
  };
}
