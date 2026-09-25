import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";

import { WORKSPACE_POLICY_SCOPE_KEY } from "../infrastructure/ModelGovernanceRepository";
import { loadRegistryScope, usableRoutes } from "./scope";

export interface GovernedModel {
  id: string;
  provider: string;
}

export interface ApprovedRoute extends GovernedModel {
  routeId: string;
  versionId: string;
}

export interface ProjectModelGovernance {
  enforced: boolean;
  approved: ApprovedRoute[];
  routeFor(model: GovernedModel): ApprovedRoute | undefined;
}

function routeKey(model: GovernedModel): string {
  return `${model.provider}:${model.id}`;
}

export async function resolveProjectModelGovernance(
  repositories: RepositoryManager,
  project: { id: string; workspace_id: string },
): Promise<ProjectModelGovernance> {
  const [policy, routes] = await Promise.all([
    repositories.modelGovernance.getPolicy(project.workspace_id, WORKSPACE_POLICY_SCOPE_KEY),
    repositories.modelRoutes.listRoutes(project.workspace_id, { activeOnly: true }),
  ]);
  const enforced = policy?.enforcement === "enforced";

  if (routes.length === 0) {
    return { enforced, approved: [], routeFor: () => undefined };
  }

  const scope = await loadRegistryScope(repositories, project.workspace_id, project.id, {
    versionIds: [...new Set(routes.map((route) => route.version_id))],
  });
  const approved = usableRoutes(scope).map((route) => ({
    id: route.provider_model_id,
    provider: route.provider,
    routeId: route.id,
    versionId: route.version_id,
  }));
  const byKey = new Map(approved.map((route) => [routeKey(route), route]));

  return { enforced, approved, routeFor: (model) => byKey.get(routeKey(model)) };
}
