import {
  DEFAULT_WORKSPACE_POLICY_RULES,
  evaluatePolicies,
  hashPolicyRules,
  type PolicySubject,
  type ScopedPolicy,
} from "@ngriffin_uk/polychat-library-model-registry";
import type {
  ModelEvidence,
  ModelPolicy,
  PolicyDryRunRequest,
  PolicyDryRunResult,
  PoliciesResponse,
  PolicyVerdict,
  UpsertPolicyRequest,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";

import type { ModelAssetRecord, ModelVersionRecord } from "../infrastructure/ModelAssetRepository";
import { WORKSPACE_POLICY_SCOPE_KEY } from "../infrastructure/ModelGovernanceRepository";
import type { ModelRouteRecord } from "../infrastructure/ModelRouteRepository";
import { requireRegistryGovernor, requireRegistryMember, requireWorkspaceProject } from "./access";
import { toModelEvidence, toModelPolicy } from "./mappers";

export interface PolicyStack {
  workspace: ModelPolicy;
  project: ModelPolicy | null;
  scoped: ScopedPolicy[];
}

async function defaultWorkspacePolicy(workspaceId: string): Promise<ModelPolicy> {
  return {
    id: `default:${workspaceId}`,
    workspaceId,
    projectId: null,
    rules: DEFAULT_WORKSPACE_POLICY_RULES,
    revision: 0,
    hash: await hashPolicyRules(DEFAULT_WORKSPACE_POLICY_RULES),
    enforcement: "advisory",
    updatedAt: new Date(0).toISOString(),
    updatedBy: null,
    isDefault: true,
  };
}

export async function loadPolicyStack(
  repositories: RepositoryManager,
  workspaceId: string,
  projectId: string | null,
): Promise<PolicyStack> {
  const [workspaceRecord, projectRecord] = await Promise.all([
    repositories.modelGovernance.getPolicy(workspaceId, WORKSPACE_POLICY_SCOPE_KEY),
    projectId ? repositories.modelGovernance.getPolicy(workspaceId, projectId) : null,
  ]);
  const workspace = workspaceRecord
    ? toModelPolicy(workspaceRecord)
    : await defaultWorkspacePolicy(workspaceId);
  const project = projectRecord ? toModelPolicy(projectRecord) : null;
  const scoped: ScopedPolicy[] = [
    { id: workspace.id, hash: workspace.hash, scope: "workspace", rules: workspace.rules },
  ];

  if (project) {
    scoped.push({ id: project.id, hash: project.hash, scope: "project", rules: project.rules });
  }

  return { workspace, project, scoped };
}

function buildPolicySubject(
  asset: ModelAssetRecord,
  version: ModelVersionRecord,
  evidence: readonly ModelEvidence[],
  route?: ModelRouteRecord | null,
): PolicySubject {
  const latest = new Map<string, ModelEvidence>();

  for (const item of evidence) {
    if (item.versionId !== version.id) {
      continue;
    }

    if (item.routeId !== null && item.routeId !== route?.id) {
      continue;
    }

    const key = `${item.kind}:${item.routeId ?? ""}`;
    const existing = latest.get(key);

    if (!existing || existing.observedAt < item.observedAt) {
      latest.set(key, item);
    }
  }

  return {
    kind: asset.kind,
    source: asset.source,
    attributes: version.attributes,
    evidence: [...latest.values()].map((item) => ({
      kind: item.kind,
      status: item.status,
      summary: item.summary,
    })),
    route: route ? { region: route.region, weightsVerified: route.weights_verified } : undefined,
  };
}

export function evaluateVersion(
  stack: PolicyStack,
  asset: ModelAssetRecord,
  version: ModelVersionRecord,
  evidence: readonly ModelEvidence[],
  route?: ModelRouteRecord | null,
): PolicyVerdict {
  return evaluatePolicies(buildPolicySubject(asset, version, evidence, route), stack.scoped);
}

export async function getPolicies(
  context: ServiceContext,
  workspaceId: string,
): Promise<PoliciesResponse> {
  await requireRegistryMember(context, workspaceId);

  const records = await context.repositories.modelGovernance.listPolicies(workspaceId);
  const workspaceRecord = records.find((record) => record.scope_key === WORKSPACE_POLICY_SCOPE_KEY);

  return {
    workspace: workspaceRecord
      ? toModelPolicy(workspaceRecord)
      : await defaultWorkspacePolicy(workspaceId),
    projects: records
      .filter((record) => record.scope_key !== WORKSPACE_POLICY_SCOPE_KEY)
      .map(toModelPolicy),
  };
}

export async function upsertPolicy(
  context: ServiceContext,
  workspaceId: string,
  request: UpsertPolicyRequest,
): Promise<ModelPolicy> {
  const { userId } = await requireRegistryGovernor(context, workspaceId);
  const projectId = await requireWorkspaceProject(context, workspaceId, request.projectId);
  const existing = await context.repositories.modelGovernance.getPolicy(
    workspaceId,
    projectId ?? WORKSPACE_POLICY_SCOPE_KEY,
  );
  const enforcement = projectId
    ? "advisory"
    : (request.enforcement ?? existing?.enforcement ?? "advisory");
  const hash = await hashPolicyRules(request.rules);
  const saved = await context.repositories.modelGovernance.savePolicy({
    workspaceId,
    projectId,
    rules: request.rules,
    hash,
    enforcement,
    updatedBy: userId,
  });

  if (saved.revision !== existing?.revision) {
    await context.repositories.audit.createRecord({
      workspaceId,
      actorUserId: userId,
      action: "model_policy.updated",
      targetType: "model_policy",
      targetId: saved.id,
      metadata: {
        projectId,
        revision: saved.revision,
        hash,
        enforcement,
        ruleIds: request.rules.map((rule) => rule.id),
      },
    });
  }

  return toModelPolicy(saved);
}

export async function dryRunPolicy(
  context: ServiceContext,
  workspaceId: string,
  request: PolicyDryRunRequest,
): Promise<PolicyDryRunResult> {
  await requireRegistryGovernor(context, workspaceId);

  const projectId = await requireWorkspaceProject(context, workspaceId, request.projectId);
  const repositories = context.repositories;
  const current = await loadPolicyStack(repositories, workspaceId, projectId);
  const candidateHash = await hashPolicyRules(request.rules);
  const candidate: ScopedPolicy = {
    id: "dry-run",
    hash: candidateHash,
    scope: projectId ? "project" : "workspace",
    rules: request.rules,
  };
  const proposed: ScopedPolicy[] = projectId
    ? [current.scoped[0], candidate]
    : [candidate, ...current.scoped.slice(1)];
  const [versions, assets] = await Promise.all([
    repositories.modelAssets.listVersions(workspaceId, request.versionIds),
    repositories.modelAssets.listAssets(workspaceId),
  ]);
  const evidence = (
    await repositories.modelGovernance.listEvidence(versions.map((version) => version.id))
  ).map(toModelEvidence);
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const changes: PolicyDryRunResult["changes"] = [];

  for (const version of versions) {
    const asset = assetsById.get(version.asset_id);

    if (!asset) {
      continue;
    }

    const subject = buildPolicySubject(asset, version, evidence);
    const before = evaluatePolicies(subject, current.scoped).effect;
    const after = evaluatePolicies(subject, proposed).effect;

    if (before !== after) {
      changes.push({
        versionId: version.id,
        displayName: `${asset.display_name}@${version.revision.slice(0, 7)}`,
        before,
        after,
      });
    }
  }

  return { changes, evaluated: versions.length };
}
