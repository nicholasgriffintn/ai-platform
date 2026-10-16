import { parsePlatformChatModelId } from "@ngriffin_uk/polychat-schemas";

import type { Repositories } from "~/infrastructure/database/repositories";
import { conflict, notFound } from "~/modules/model-registry/application/access";
import { loadRegistryScope, routeStanding } from "~/modules/model-registry/application/scope";
import { ModelRouteRepository } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import type { ModelRouteRecord } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import { ModelAliasRepository } from "~/modules/model-serving/infrastructure/ModelAliasRepository";
import { ModelDeploymentRepository } from "~/modules/model-serving/infrastructure/ModelDeploymentRepository";

import { chooseAliasRoute } from "./aliases";

export async function resolveScopedModelRoute(
  repositories: Repositories,
  workspaceId: string,
  projectId: string | null,
  model: string,
): Promise<ModelRouteRecord> {
  const parsed = parsePlatformChatModelId(model);
  let routeId: string | null = null;

  if (parsed?.kind === "alias") {
    const alias = await repositories.get(ModelAliasRepository).get(workspaceId, parsed.id);

    if (alias && (alias.project_id === null || alias.project_id === projectId)) {
      routeId = chooseAliasRoute(alias);
    }
  } else if (parsed?.kind === "deployment") {
    const deployment = await repositories
      .get(ModelDeploymentRepository)
      .get(workspaceId, parsed.id);

    if (deployment && (deployment.project_id === null || deployment.project_id === projectId)) {
      routeId = deployment.route_id;
    }
  }

  const route = routeId
    ? await repositories.get(ModelRouteRepository).getRoute(workspaceId, routeId)
    : null;

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
