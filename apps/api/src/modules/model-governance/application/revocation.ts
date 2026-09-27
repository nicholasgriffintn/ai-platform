import { collectDescendants } from "@ngriffin_uk/polychat-library-model-registry";
import {
  type RevocationResult,
  type RevokeVersionRequest,
  revokeVersionRequestSchema,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { notFound, requireModelAction } from "~/modules/model-registry/application/access";
import { loadRegistryScope, versionStanding } from "~/modules/model-registry/application/scope";
import { applyDeploymentState } from "~/modules/model-serving/application/deployments";

export async function revokeVersion(
  context: ServiceContext,
  workspaceId: string,
  versionId: string,
  input: RevokeVersionRequest,
): Promise<RevocationResult> {
  const { userId } = await requireModelAction(context, workspaceId, "approve");
  const { reason } = revokeVersionRequestSchema.parse(input);
  const repositories = context.repositories;
  const version = await repositories.modelAssets.getVersion(workspaceId, versionId);

  if (!version) {
    throw notFound("Model version");
  }

  const edges = (await repositories.modelAssets.listLineage(workspaceId)).filter(
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
    repositories.modelGovernance.listDecisions(workspaceId, { versionIds }),
    repositories.modelRoutes.listRoutes(workspaceId, { versionIds, activeOnly: true }),
    repositories.modelDeployments.list(workspaceId, { liveOnly: true, versionIds }),
  ]);
  const routeIds = routes.map((route) => route.id);
  const aliases = await repositories.modelAliases.listByRoutes(routeIds);
  const note = `Revoked: ${reason}`;

  for (const decision of decisions.filter(
    (item) => item.state === "approved" || item.state === "pending",
  )) {
    await repositories.modelGovernance.resolveDecision({
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
      await repositories.modelGovernance.createDecision({
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

    await repositories.modelAliases.update(alias.id, {
      ...(routeGone ? { route_id: canaryGone ? null : alias.canary_route_id } : {}),
      canary_route_id: null,
      canary_percent: 0,
      updated_by: userId,
    });
    await repositories.modelAliases.addEvent({
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
    await repositories.modelRoutes.setStatus(route.id, "retired");
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

  await repositories.audit.createRecord({
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
