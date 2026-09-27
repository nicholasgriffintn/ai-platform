import { evaluateGate } from "@ngriffin_uk/polychat-library-model-registry";
import type { AliasGate } from "@ngriffin_uk/polychat-schemas";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { conflict, notFound } from "~/modules/model-registry/application/access";
import { loadRegistryScope, routeStanding } from "~/modules/model-registry/application/scope";

export async function requireAliasGateSuite(
  repositories: RepositoryManager,
  workspaceId: string,
  gate: AliasGate | null | undefined,
): Promise<void> {
  if (gate && !(await repositories.modelEvals.getSuite(workspaceId, gate.suiteId))) {
    throw notFound("Gate suite");
  }
}

export async function evaluateAliasTarget(
  repositories: RepositoryManager,
  workspaceId: string,
  projectId: string | null,
  routeId: string,
  gate: AliasGate | null,
) {
  const route = await repositories.modelRoutes.getRoute(workspaceId, routeId);

  if (!route || route.status !== "active") {
    throw notFound("Active route");
  }

  const scope = await loadRegistryScope(repositories, workspaceId, projectId, {
    versionIds: [route.version_id],
  });

  if (!routeStanding(scope, route)?.usable) {
    throw conflict("This route is not approved for the alias's scope yet");
  }

  await requireAliasGateSuite(repositories, workspaceId, gate);

  const gateRun = gate
    ? await repositories.modelEvals.latestCompletedRun(gate.suiteId, route.id)
    : null;

  return {
    route,
    gate: gate
      ? { ...evaluateGate(gate, gateRun?.scores ?? null), runId: gateRun?.id ?? null }
      : null,
  };
}
