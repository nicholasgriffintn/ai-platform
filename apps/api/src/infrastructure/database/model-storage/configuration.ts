import type {
  ConnectionCapabilities,
  EvalCase,
  GraderConfig,
  PolicyRule,
  MODEL_PROVIDER_IDS,
} from "@ngriffin_uk/polychat-schemas";
import { sql } from "drizzle-orm";

import { modelConfiguration } from "../schema";
import {
  storageJsonField,
  storageScalarField,
  storageBooleanField,
  storageJsonObject,
  storageJsonPatch,
  type StorageChanges,
  type StorageRecord,
} from "../storage-json";

export type ModelPolicyRecord = StorageRecord<typeof modelPolicy>;

type ModelPolicyInsert = Pick<
  ModelPolicyRecord,
  "id" | "workspace_id" | "scope_key" | "rules" | "hash"
> &
  Partial<
    Pick<ModelPolicyRecord, "project_id" | "revision" | "enforcement" | "updated_by" | "updated_at">
  >;

export const modelPolicy = {
  id: sql<string>`${modelConfiguration.id}`,
  workspace_id: sql<string>`${modelConfiguration.workspace_id}`,
  project_id: sql<string | null>`${modelConfiguration.project_id}`,
  scope_key: sql<string>`${modelConfiguration.scope_key}`,
  rules: storageJsonField<PolicyRule[]>(modelConfiguration.data, "rules"),
  revision: sql<number>`${modelConfiguration.revision}`,
  hash: storageScalarField<string>(modelConfiguration.data, "hash"),
  enforcement: storageScalarField<"advisory" | "enforced">(modelConfiguration.data, "enforcement"),
  updated_by: sql<number | null>`${modelConfiguration.updated_by}`,
  updated_at: sql<string>`${modelConfiguration.updated_at}`,
};

export function modelPolicyValues(input: ModelPolicyInsert) {
  return {
    kind: "policy",
    id: input.id,
    workspace_id: input.workspace_id,
    project_id: input.project_id ?? null,
    scope_key: input.scope_key,
    revision: input.revision ?? 1,
    updated_by: input.updated_by ?? null,
    updated_at: input.updated_at ?? sql`(CURRENT_TIMESTAMP)`,
    data: storageJsonObject({
      rules: input.rules,
      hash: input.hash,
      enforcement: input.enforcement ?? "advisory",
    }),
  };
}

export function modelPolicyChanges(input: StorageChanges<ModelPolicyRecord>) {
  return {
    id: input.id,
    workspace_id: input.workspace_id,
    project_id: input.project_id,
    scope_key: input.scope_key,
    revision: input.revision,
    updated_by: input.updated_by,
    updated_at: input.updated_at,
    data: storageJsonPatch(modelConfiguration.data, {
      rules: input.rules,
      hash: input.hash,
      enforcement: input.enforcement,
    }),
  };
}

export type ModelBudgetRecord = StorageRecord<typeof modelBudget>;

type ModelBudgetInsert = Pick<
  ModelBudgetRecord,
  "id" | "workspace_id" | "scope_key" | "monthly_limit_usd"
> &
  Partial<
    Pick<
      ModelBudgetRecord,
      | "project_id"
      | "soft_limit_percent"
      | "hard_stop"
      | "approval_above_usd"
      | "idle_pause_minutes"
      | "updated_by"
      | "updated_at"
    >
  >;

export const modelBudget = {
  id: sql<string>`${modelConfiguration.id}`,
  workspace_id: sql<string>`${modelConfiguration.workspace_id}`,
  project_id: sql<string | null>`${modelConfiguration.project_id}`,
  scope_key: sql<string>`${modelConfiguration.scope_key}`,
  monthly_limit_usd: storageScalarField<number>(modelConfiguration.data, "monthly_limit_usd"),
  soft_limit_percent: storageScalarField<number>(modelConfiguration.data, "soft_limit_percent"),
  hard_stop: storageBooleanField(modelConfiguration.data, "hard_stop"),
  approval_above_usd: storageJsonField<number | null>(
    modelConfiguration.data,
    "approval_above_usd",
  ),
  idle_pause_minutes: storageJsonField<number | null>(
    modelConfiguration.data,
    "idle_pause_minutes",
  ),
  updated_by: sql<number | null>`${modelConfiguration.updated_by}`,
  updated_at: sql<string>`${modelConfiguration.updated_at}`,
};

export function modelBudgetValues(input: ModelBudgetInsert) {
  return {
    kind: "budget",
    id: input.id,
    workspace_id: input.workspace_id,
    project_id: input.project_id ?? null,
    scope_key: input.scope_key,
    updated_by: input.updated_by ?? null,
    updated_at: input.updated_at ?? sql`(CURRENT_TIMESTAMP)`,
    data: storageJsonObject({
      monthly_limit_usd: input.monthly_limit_usd,
      soft_limit_percent: input.soft_limit_percent ?? 80,
      hard_stop: input.hard_stop ?? true,
      approval_above_usd: input.approval_above_usd ?? null,
      idle_pause_minutes: input.idle_pause_minutes ?? null,
    }),
  };
}

export function modelBudgetChanges(input: StorageChanges<ModelBudgetRecord>) {
  return {
    id: input.id,
    workspace_id: input.workspace_id,
    project_id: input.project_id,
    scope_key: input.scope_key,
    updated_by: input.updated_by,
    updated_at: input.updated_at,
    data: storageJsonPatch(modelConfiguration.data, {
      monthly_limit_usd: input.monthly_limit_usd,
      soft_limit_percent: input.soft_limit_percent,
      hard_stop: input.hard_stop,
      approval_above_usd: input.approval_above_usd,
      idle_pause_minutes: input.idle_pause_minutes,
    }),
  };
}

export type ModelEvalSuiteRecord = StorageRecord<typeof modelEvalSuite>;

type ModelEvalSuiteInsert = Pick<ModelEvalSuiteRecord, "id" | "workspace_id" | "name" | "cases"> &
  Partial<
    Pick<
      ModelEvalSuiteRecord,
      | "project_id"
      | "description"
      | "system_prompt"
      | "grader_ids"
      | "replay_sample_size"
      | "created_by"
      | "created_at"
      | "updated_at"
    >
  >;

export const modelEvalSuite = {
  id: sql<string>`${modelConfiguration.id}`,
  workspace_id: sql<string>`${modelConfiguration.workspace_id}`,
  project_id: sql<string | null>`${modelConfiguration.project_id}`,
  name: sql<string>`${modelConfiguration.name}`,
  description: storageScalarField<string | null>(modelConfiguration.data, "description"),
  system_prompt: storageScalarField<string | null>(modelConfiguration.data, "system_prompt"),
  cases: storageJsonField<EvalCase[]>(modelConfiguration.data, "cases"),
  grader_ids: storageJsonField<string[]>(modelConfiguration.data, "grader_ids"),
  replay_sample_size: storageScalarField<number>(modelConfiguration.data, "replay_sample_size"),
  created_by: sql<number | null>`${modelConfiguration.created_by}`,
  created_at: sql<string>`${modelConfiguration.created_at}`,
  updated_at: sql<string>`${modelConfiguration.updated_at}`,
};

export function modelEvalSuiteValues(input: ModelEvalSuiteInsert) {
  return {
    kind: "suite",
    id: input.id,
    workspace_id: input.workspace_id,
    project_id: input.project_id ?? null,
    name: input.name,
    created_by: input.created_by ?? null,
    created_at: input.created_at ?? sql`(CURRENT_TIMESTAMP)`,
    updated_at: input.updated_at ?? sql`(CURRENT_TIMESTAMP)`,
    scope_key: input.id,
    data: storageJsonObject({
      description: input.description ?? null,
      system_prompt: input.system_prompt ?? null,
      cases: input.cases,
      grader_ids: input.grader_ids ?? [],
      replay_sample_size: input.replay_sample_size ?? 50,
    }),
  };
}

export type ModelGraderRecord = StorageRecord<typeof modelGrader>;

type ModelGraderInsert = Pick<
  ModelGraderRecord,
  "id" | "workspace_id" | "name" | "metric" | "config"
> &
  Partial<
    Pick<
      ModelGraderRecord,
      "project_id" | "description" | "revision" | "created_by" | "created_at" | "updated_at"
    >
  >;

export const modelGrader = {
  id: sql<string>`${modelConfiguration.id}`,
  workspace_id: sql<string>`${modelConfiguration.workspace_id}`,
  project_id: sql<string | null>`${modelConfiguration.project_id}`,
  name: sql<string>`${modelConfiguration.name}`,
  metric: storageScalarField<string>(modelConfiguration.data, "metric"),
  description: storageScalarField<string | null>(modelConfiguration.data, "description"),
  config: storageJsonField<GraderConfig>(modelConfiguration.data, "config"),
  revision: sql<number>`${modelConfiguration.revision}`,
  created_by: sql<number | null>`${modelConfiguration.created_by}`,
  created_at: sql<string>`${modelConfiguration.created_at}`,
  updated_at: sql<string>`${modelConfiguration.updated_at}`,
};

export function modelGraderValues(input: ModelGraderInsert) {
  return {
    kind: "grader",
    id: input.id,
    workspace_id: input.workspace_id,
    project_id: input.project_id ?? null,
    name: input.name,
    revision: input.revision ?? 1,
    created_by: input.created_by ?? null,
    created_at: input.created_at ?? sql`(CURRENT_TIMESTAMP)`,
    updated_at: input.updated_at ?? sql`(CURRENT_TIMESTAMP)`,
    scope_key: input.id,
    data: storageJsonObject({
      metric: input.metric,
      description: input.description ?? null,
      config: input.config,
    }),
  };
}

export function modelGraderChanges(input: StorageChanges<ModelGraderRecord>) {
  return {
    id: input.id,
    workspace_id: input.workspace_id,
    project_id: input.project_id,
    name: input.name,
    revision: input.revision,
    created_by: input.created_by,
    created_at: input.created_at,
    updated_at: input.updated_at,
    data: storageJsonPatch(modelConfiguration.data, {
      metric: input.metric,
      description: input.description,
      config: input.config,
    }),
  };
}

export type WorkspaceProviderConnectionRecord = StorageRecord<typeof workspaceProviderConnection>;

type WorkspaceProviderConnectionInsert = Pick<
  WorkspaceProviderConnectionRecord,
  "workspace_id" | "provider" | "encrypted_secret"
> &
  Partial<
    Pick<
      WorkspaceProviderConnectionRecord,
      "account" | "config" | "capabilities" | "updated_by" | "updated_at"
    >
  >;

export const workspaceProviderConnection = {
  workspace_id: sql<string>`${modelConfiguration.workspace_id}`,
  provider: sql<(typeof MODEL_PROVIDER_IDS)[number]>`${modelConfiguration.scope_key}`,
  encrypted_secret: sql<string>`${modelConfiguration.encrypted_secret}`,
  account: storageScalarField<string | null>(modelConfiguration.data, "account"),
  config: storageJsonField<Record<string, string>>(modelConfiguration.data, "config"),
  capabilities: storageJsonField<ConnectionCapabilities>(modelConfiguration.data, "capabilities"),
  updated_by: sql<number | null>`${modelConfiguration.updated_by}`,
  updated_at: sql<string>`${modelConfiguration.updated_at}`,
};

export function workspaceProviderConnectionValues(input: WorkspaceProviderConnectionInsert) {
  return {
    kind: "connection",
    id: `connection:${input.workspace_id}:${input.provider}`,
    workspace_id: input.workspace_id,
    scope_key: input.provider,
    encrypted_secret: input.encrypted_secret,
    updated_by: input.updated_by ?? null,
    updated_at: input.updated_at ?? sql`(CURRENT_TIMESTAMP)`,
    data: storageJsonObject({
      account: input.account ?? null,
      config: input.config ?? {},
      capabilities: input.capabilities ?? { read: false, store: false, train: false, host: false },
    }),
  };
}

export function workspaceProviderConnectionChanges(
  input: StorageChanges<WorkspaceProviderConnectionRecord>,
) {
  return {
    workspace_id: input.workspace_id,
    scope_key: input.provider,
    encrypted_secret: input.encrypted_secret,
    updated_by: input.updated_by,
    updated_at: input.updated_at,
    data: storageJsonPatch(modelConfiguration.data, {
      account: input.account,
      config: input.config,
      capabilities: input.capabilities,
    }),
  };
}
