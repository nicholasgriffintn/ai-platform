import type {
  EvalRun,
  EvalSuite,
  ModelAsset,
  ModelDecision,
  ModelEvidence,
  ModelPolicy,
  ModelRoute,
  ModelVersion,
  ModelVersionFile,
  WeightFormat,
} from "@ngriffin_uk/polychat-schemas";
import { WEIGHT_FORMATS } from "@ngriffin_uk/polychat-schemas";

import type {
  ModelAssetRecord,
  ModelFileRecord,
  ModelVersionRecord,
} from "../infrastructure/ModelAssetRepository";
import type {
  ModelEvalRunRecord,
  ModelEvalSuiteRecord,
} from "../infrastructure/ModelEvalRepository";
import type {
  ModelDecisionRecord,
  ModelEvidenceRecord,
  ModelPolicyRecord,
} from "../infrastructure/ModelGovernanceRepository";
import type { ModelRouteRecord } from "../infrastructure/ModelRouteRepository";

function readFormat(value: string | null): WeightFormat | null {
  return WEIGHT_FORMATS.find((format) => format === value) ?? null;
}

export function toModelAsset(record: ModelAssetRecord): ModelAsset {
  return {
    id: record.id,
    workspaceId: record.workspace_id,
    kind: record.kind,
    source: record.source,
    sourceRef: record.source_ref,
    displayName: record.display_name,
    createdAt: record.created_at,
    createdBy: record.created_by,
  };
}

export function toModelVersion(record: ModelVersionRecord): ModelVersion {
  return {
    id: record.id,
    assetId: record.asset_id,
    workspaceId: record.workspace_id,
    revision: record.revision,
    status: record.status,
    attributes: record.attributes,
    failureReason: record.failure_reason,
    createdAt: record.created_at,
    createdBy: record.created_by,
  };
}

export function toModelFile(record: ModelFileRecord): ModelVersionFile {
  return {
    path: record.path,
    size: record.size,
    sha256: record.sha256,
    format: readFormat(record.format),
  };
}

export function toModelEvidence(record: ModelEvidenceRecord): ModelEvidence {
  return {
    id: record.id,
    versionId: record.version_id,
    routeId: record.route_id,
    kind: record.kind,
    source: record.source,
    status: record.status,
    summary: record.summary,
    details: record.details,
    observedAt: record.observed_at,
  };
}

export function toModelPolicy(record: ModelPolicyRecord): ModelPolicy {
  return {
    id: record.id,
    workspaceId: record.workspace_id,
    projectId: record.project_id,
    rules: record.rules,
    revision: record.revision,
    hash: record.hash,
    enforcement: record.enforcement,
    updatedAt: record.updated_at,
    updatedBy: record.updated_by,
    isDefault: false,
  };
}

export function toModelDecision(record: ModelDecisionRecord): ModelDecision {
  return {
    id: record.id,
    workspaceId: record.workspace_id,
    projectId: record.project_id,
    versionId: record.version_id,
    routeId: record.route_id,
    state: record.state,
    verdict: record.verdict,
    evidenceIds: record.evidence_ids,
    isException: record.is_exception,
    conditions: record.conditions,
    note: record.note,
    requestedBy: record.requested_by,
    decidedBy: record.decided_by,
    decidedAt: record.decided_at,
    expiresAt: record.expires_at,
    createdAt: record.created_at,
  };
}

export function toModelRoute(record: ModelRouteRecord): ModelRoute {
  return {
    id: record.id,
    workspaceId: record.workspace_id,
    versionId: record.version_id,
    provider: record.provider,
    providerModelId: record.provider_model_id,
    region: record.region,
    weightsVerified: record.weights_verified,
    status: record.status,
    deploymentRef: record.deployment_ref,
    createdAt: record.created_at,
  };
}

export function toEvalSuite(record: ModelEvalSuiteRecord): EvalSuite {
  return {
    id: record.id,
    workspaceId: record.workspace_id,
    projectId: record.project_id,
    name: record.name,
    description: record.description,
    systemPrompt: record.system_prompt,
    cases: record.cases,
    scorers: record.scorers,
    replaySampleSize: record.replay_sample_size,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function toEvalRun(record: ModelEvalRunRecord): EvalRun {
  return {
    id: record.id,
    suiteId: record.suite_id,
    routeId: record.route_id,
    versionId: record.version_id,
    trigger: record.trigger,
    status: record.status,
    scores: record.scores,
    latencyP95Ms: record.latency_p95_ms,
    casesCompleted: record.cases_completed,
    casesTotal: record.cases_total,
    failureReason: record.failure_reason,
    createdAt: record.created_at,
    completedAt: record.completed_at,
  };
}
