import { isVerdictCovered } from "@ngriffin_uk/polychat-library-model-registry";
import type { ModelEvidence, PolicyVerdict } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";

import type { ModelAssetRecord, ModelVersionRecord } from "../infrastructure/ModelAssetRepository";
import type { ModelDecisionRecord } from "../infrastructure/ModelGovernanceRepository";
import type { ModelRouteRecord } from "../infrastructure/ModelRouteRepository";
import { notFound } from "./access";
import { toModelEvidence } from "./mappers";
import { evaluateVersion, loadPolicyStack, type PolicyStack } from "./policies";

export interface RegistryScope {
  workspaceId: string;
  projectId: string | null;
  stack: PolicyStack;
  assets: Map<string, ModelAssetRecord>;
  versions: ModelVersionRecord[];
  evidence: ModelEvidence[];
  decisions: ModelDecisionRecord[];
  routes: ModelRouteRecord[];
}

export interface Standing {
  verdict: PolicyVerdict;
  usable: boolean;
  decision: ModelDecisionRecord | null;
}

export async function loadRegistryScope(
  repositories: RepositoryManager,
  workspaceId: string,
  projectId: string | null,
  { versionIds }: { versionIds?: string[] } = {},
): Promise<RegistryScope> {
  const [stack, assets, versions] = await Promise.all([
    loadPolicyStack(repositories, workspaceId, projectId),
    repositories.modelAssets.listAssets(workspaceId),
    repositories.modelAssets.listVersions(workspaceId, versionIds),
  ]);
  const ids = versions.map((version) => version.id);
  const [evidence, decisions, routes] = await Promise.all([
    repositories.modelGovernance.listEvidence(ids),
    repositories.modelGovernance.listDecisions(workspaceId, { versionIds: ids }),
    repositories.modelRoutes.listRoutes(workspaceId, { versionIds: ids }),
  ]);

  return {
    workspaceId,
    projectId,
    stack,
    assets: new Map(assets.map((asset) => [asset.id, asset])),
    versions,
    evidence: evidence.map(toModelEvidence),
    decisions: decisions.filter(
      (decision) => decision.project_id === null || decision.project_id === projectId,
    ),
    routes,
  };
}

function coveringApprovals(
  scope: RegistryScope,
  versionId: string,
  routeId: string | null,
): ModelDecisionRecord[] {
  return scope.decisions.filter(
    (decision) =>
      decision.version_id === versionId &&
      decision.state === "approved" &&
      (decision.route_id === null || decision.route_id === routeId),
  );
}

function latestDecision(
  scope: RegistryScope,
  versionId: string,
  routeId: string | null,
): ModelDecisionRecord | null {
  return (
    scope.decisions.find(
      (decision) =>
        decision.version_id === versionId &&
        decision.route_id === routeId &&
        (decision.project_id === scope.projectId || decision.project_id === null),
    ) ?? null
  );
}

function standing(
  scope: RegistryScope,
  version: ModelVersionRecord,
  route: ModelRouteRecord | null,
  now: Date,
): Standing | null {
  const asset = scope.assets.get(version.asset_id);

  if (!asset) {
    return null;
  }

  const verdict = evaluateVersion(scope.stack, asset, version, scope.evidence, route);
  const approvals = coveringApprovals(scope, version.id, route?.id ?? null).map((decision) => ({
    verdict: decision.verdict,
    isException: decision.is_exception,
    expiresAt: decision.expires_at,
  }));

  return {
    verdict,
    usable: version.status === "ready" && isVerdictCovered(verdict, approvals, now),
    decision: latestDecision(scope, version.id, route?.id ?? null),
  };
}

export function versionStanding(
  scope: RegistryScope,
  version: ModelVersionRecord,
  now = new Date(),
): Standing | null {
  return standing(scope, version, null, now);
}

export function routeStanding(
  scope: RegistryScope,
  route: ModelRouteRecord,
  now = new Date(),
): Standing | null {
  const version = scope.versions.find((item) => item.id === route.version_id);

  if (!version) {
    return null;
  }

  const result = standing(scope, version, route, now);

  return result ? { ...result, usable: result.usable && route.status === "active" } : null;
}

export function usableRoutes(scope: RegistryScope, now = new Date()): ModelRouteRecord[] {
  return scope.routes.filter((route) => routeStanding(scope, route, now)?.usable === true);
}

export async function requireUsableVersion(
  repositories: RepositoryManager,
  workspaceId: string,
  projectId: string | null,
  versionId: string,
  label: string,
): Promise<ModelVersionRecord> {
  const scope = await loadRegistryScope(repositories, workspaceId, projectId, {
    versionIds: [versionId],
  });
  const version = scope.versions[0];

  if (!version) {
    throw notFound(label);
  }

  const current = versionStanding(scope, version);

  if (!current?.usable) {
    const issues = current?.verdict.matches
      .filter((match) => match.effect === "review" || match.effect === "block")
      .map((match) => match.ruleId);

    throw new AssistantError(
      `The ${label.toLowerCase()} is not approved for this scope${issues?.length ? ` (${issues.join(", ")})` : ""}`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return version;
}
