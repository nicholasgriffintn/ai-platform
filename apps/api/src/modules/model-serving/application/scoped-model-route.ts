import { parsePlatformChatModelId } from "@ngriffin_uk/polychat-schemas";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { conflict, notFound } from "~/modules/model-registry/application/access";
import { loadRegistryScope, routeStanding } from "~/modules/model-registry/application/scope";
import type { ModelRouteRecord } from "~/modules/model-registry/infrastructure/ModelRouteRepository";

import { chooseAliasRoute } from "./aliases";

export async function resolveScopedModelRoute(
  repositories: RepositoryManager,
  workspaceId: string,
  projectId: string | null,
  model: string,
): Promise<ModelRouteRecord> {
  const parsed = parsePlatformChatModelId(model);
  let routeId: string | null = null;

  if (parsed?.kind === "alias") {
    const alias = await repositories.modelAliases.get(workspaceId, parsed.id);

    if (alias && (alias.project_id === null || alias.project_id === projectId)) {
      routeId = chooseAliasRoute(alias);
    }
  } else if (parsed?.kind === "deployment") {
    const deployment = await repositories.modelDeployments.get(workspaceId, parsed.id);

    if (deployment && (deployment.project_id === null || deployment.project_id === projectId)) {
      routeId = deployment.route_id;
    }
  }

  const route = routeId ? await repositories.modelRoutes.getRoute(workspaceId, routeId) : null;

  if (!route) {
    throw notFound("Model route in this workspace and project");
  }

  const scope = await loadRegistryScope(repositories, workspaceId, projectId, {
    versionIds: [route.version_id],
  });

  if (!routeStanding(scope, route)?.usable) {
    throw conflict("The selected model route is not approved for this scope");
  }

  return route;
}
