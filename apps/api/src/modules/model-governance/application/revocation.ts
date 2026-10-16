import { collectDescendants } from "@ngriffin_uk/polychat-library-model-registry";
import {
  type RevocationResult,
  type RevokeVersionRequest,
  revokeVersionRequestSchema,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { notFound, requireModelAction } from "~/modules/model-registry/application/access";
import { loadRegistryScope, versionStanding } from "~/modules/model-registry/application/scope";
import { ModelAssetRepository } from "~/modules/model-registry/infrastructure/ModelAssetRepository";
import { ModelGovernanceRepository } from "~/modules/model-registry/infrastructure/ModelGovernanceRepository";
import { ModelRouteRepository } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import { applyDeploymentState } from "~/modules/model-serving/application/deployments";
import { ModelAliasRepository } from "~/modules/model-serving/infrastructure/ModelAliasRepository";
import { ModelDeploymentRepository } from "~/modules/model-serving/infrastructure/ModelDeploymentRepository";

export async function revokeVersion(
  context: ServiceContext,
  workspaceId: string,
  versionId: string,
  input: RevokeVersionRequest,
): Promise<RevocationResult> {
  const { userId } = await requireModelAction(context, workspaceId, "approve");
  const { reason } = revokeVersionRequestSchema.parse(input);
  const repositories = context.repositories;
  const version = await repositories.get(ModelAssetRepository).getVersion(workspaceId, versionId);

  if (!version) {
    throw notFound("Model version");
  }

  const edges = (await repositories.get(ModelAssetRepository).listLineage(workspaceId)).filter(
    (edge) => edge.relation !== "evaluated_on",
  );
  const versionIds = [...new Set([versionId, ...collectDescendants(edges, versionId)])];

  return revokeVersionSet(context, workspaceId, versionId, versionIds, reason, userId);
}

export async function revokeVersionSet(
  context: ServiceContext,
  workspaceId: string,
  versionId: string,
  versionIds: string[],
  reason: string,
  userId: number,
): Promise<RevocationResult> {
  const repositories = context.repositories;
  const scope = await loadRegistryScope(repositories, workspaceId, null, { versionIds });
  const [decisions, routes, deployments] = await Promise.all([
    repositories.get(ModelGovernanceRepository).listDecisions(workspaceId, { versionIds }),
    repositories
      .get(ModelRouteRepository)
      .listRoutes(workspaceId, { versionIds, activeOnly: true }),
    repositories.get(ModelDeploymentRepository).list(workspaceId, { liveOnly: true, versionIds }),
  ]);
  const routeIds = routes.map((route) => route.id);
  const aliases = await repositories.get(ModelAliasRepository).listByRoutes(routeIds);
  const note = `Revoked: ${reason}`;

  for (const decision of decisions.filter(
    (item) => item.state === "approved" || item.state === "pending",
  )) {
    await repositories.get(ModelGovernanceRepository).resolveDecision({
      decisionId: decision.id,
      state: "revoked",
      decidedBy: userId,
      note,
      conditions: decision.conditions,
      expiresAt: null,
    });
  }

  for (const version of scope.versions) {
    const current = versionStanding(scope, version);

    if (current) {
      await repositories.get(ModelGovernanceRepository).createDecision({
        workspaceId,
        projectId: null,
        versionId: version.id,
        routeId: null,
        state: "revoked",
        verdict: current.verdict,
        evidenceIds: scope.evidence
          .filter((item) => item.versionId === version.id)
          .map((item) => item.id),
        isException: false,
        note,
        requestedBy: userId,
        decidedBy: userId,
      });
    }
  }

  for (const alias of aliases) {
    const routeGone = alias.route_id !== null && routeIds.includes(alias.route_id);
    const canaryGone = alias.canary_route_id !== null && routeIds.includes(alias.canary_route_id);

    await repositories.get(ModelAliasRepository).update(alias.id, {
      ...(routeGone ? { route_id: canaryGone ? null : alias.canary_route_id } : {}),
      canary_route_id: null,
      canary_percent: 0,
      updated_by: userId,
    });
    await repositories.get(ModelAliasRepository).addEvent({
      aliasId: alias.id,
      kind: "revoked",
      fromRouteId: alias.route_id,
      toRouteId: routeGone ? (canaryGone ? null : alias.canary_route_id) : alias.route_id,
      reason: note,
      gate: null,
      actorUserId: userId,
    });
  }

  for (const route of routes) {
    await repositories.get(ModelRouteRepository).setStatus(route.id, "retired");
  }

  const paused: string[] = [];

  for (const deployment of deployments) {
    if (deployment.desired_state === "running") {
      await applyDeploymentState(context.env, repositories, deployment, "pause", {
        userId,
        reason: note,
      });
      paused.push(deployment.id);
    }
  }

  await repositories.get(AuditRepository).createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_version.revoked",
    targetType: "model_version",
    targetId: versionId,
    metadata: {
      reason,
      versionIds,
      routeIds,
      deploymentIds: paused,
      aliasIds: aliases.map((alias) => alias.id),
    },
  });

  return {
    versionId,
    retiredRouteIds: routeIds,
    pausedDeploymentIds: paused,
    clearedAliasIds: aliases.map((alias) => alias.id),
  };
}
