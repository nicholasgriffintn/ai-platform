import { pickCanaryRoute } from "@ngriffin_uk/polychat-library-model-registry";
import {
  type AliasDetail,
  type AliasesResponse,
  type CreateAliasRequest,
  createAliasRequestSchema,
  type ModelAlias,
  type PromoteAliasRequest,
  type PromotionResult,
  type UpdateAliasRequest,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import {
  badRequest,
  conflict,
  notFound,
  requireModelAction,
  requireWorkspaceProject,
} from "~/modules/model-registry/application/access";
import { toModelRoute } from "~/modules/model-registry/application/mappers";

import type { ModelAliasRecord } from "../infrastructure/ModelAliasRepository";
import { evaluateAliasTarget, requireAliasGateSuite } from "./alias-governance";
import { toAliasEvent, toModelAlias } from "./mappers";

export async function createAliasForRoute(
  repositories: RepositoryManager,
  input: {
    workspaceId: string;
    projectId: string | null;
    name: string;
    routeId: string | null;
    userId: number;
    description?: string | null;
    gate?: ModelAliasRecord["gate"];
    requiresApproval?: boolean;
  },
): Promise<ModelAliasRecord> {
  const existing = (await repositories.modelAliases.list(input.workspaceId, input.projectId)).find(
    (alias) => alias.name === input.name && alias.project_id === input.projectId,
  );

  if (existing) {
    throw conflict(`An alias called ${input.name} already exists here`);
  }

  const alias = await repositories.modelAliases.create({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    name: input.name,
    description: input.description ?? null,
    routeId: input.routeId,
    gate: input.gate ?? null,
    requiresApproval: input.requiresApproval ?? false,
    updatedBy: input.userId,
  });

  await repositories.modelAliases.addEvent({
    aliasId: alias.id,
    kind: "created",
    fromRouteId: null,
    toRouteId: input.routeId,
    reason: null,
    gate: null,
    actorUserId: input.userId,
  });

  return alias;
}

async function requireAlias(context: ServiceContext, workspaceId: string, aliasId: string) {
  const alias = await context.repositories.modelAliases.get(workspaceId, aliasId);

  if (!alias) {
    throw notFound("Alias");
  }

  return alias;
}

export async function listAliases(
  context: ServiceContext,
  workspaceId: string,
  projectIdInput?: string,
): Promise<AliasesResponse> {
  await requireModelAction(context, workspaceId, "view");

  const repositories = context.repositories;
  const projectId = await requireWorkspaceProject(context, workspaceId, projectIdInput);
  const aliases = await repositories.modelAliases.list(workspaceId, projectId);
  const routes = await repositories.modelRoutes.listByIds(
    aliases.flatMap((alias) => (alias.route_id ? [alias.route_id] : [])),
  );
  const versions = await repositories.modelAssets.listVersions(
    workspaceId,
    routes.map((route) => route.version_id),
  );
  const assets = new Map(
    (await repositories.modelAssets.listAssets(workspaceId)).map((asset) => [asset.id, asset]),
  );
  const nameFor = (routeId: string | null) => {
    const route = routes.find((item) => item.id === routeId);
    const version = route ? versions.find((item) => item.id === route.version_id) : undefined;
    const asset = version ? assets.get(version.asset_id) : undefined;

    return asset ? `${asset.display_name} · ${route?.provider}` : null;
  };

  return {
    aliases: aliases.map((alias) => ({
      ...toModelAlias(alias),
      targetName: nameFor(alias.route_id),
    })),
  };
}

export async function getAliasDetail(
  context: ServiceContext,
  workspaceId: string,
  aliasId: string,
): Promise<AliasDetail> {
  await requireModelAction(context, workspaceId, "view");

  const alias = await requireAlias(context, workspaceId, aliasId);
  const repositories = context.repositories;
  const [events, route, canaryRoute] = await Promise.all([
    repositories.modelAliases.listEvents(alias.id),
    alias.route_id ? repositories.modelRoutes.getRoute(workspaceId, alias.route_id) : null,
    alias.canary_route_id
      ? repositories.modelRoutes.getRoute(workspaceId, alias.canary_route_id)
      : null,
  ]);

  return {
    alias: toModelAlias(alias),
    events: events.map(toAliasEvent),
    route: route ? toModelRoute(route) : null,
    canaryRoute: canaryRoute ? toModelRoute(canaryRoute) : null,
  };
}

export async function createAlias(
  context: ServiceContext,
  workspaceId: string,
  input: CreateAliasRequest,
): Promise<ModelAlias> {
  const access = await requireModelAction(context, workspaceId, "promote");
  const { userId } = access;
  const request = createAliasRequestSchema.parse(input);
  const projectId = await requireWorkspaceProject(context, workspaceId, request.projectId);

  await requireAliasGateSuite(context.repositories, workspaceId, request.gate);

  if (request.routeId) {
    if (access.separationOfDuties || (request.requiresApproval && !access.actions.has("approve"))) {
      throw conflict("Create the alias without a target, then request an approved promotion");
    }

    const target = await evaluateAliasTarget(
      context.repositories,
      workspaceId,
      projectId,
      request.routeId,
      request.gate,
    );

    if (target.gate && !target.gate.passed) {
      throw conflict(`Gate failed: ${target.gate.failures.join("; ")}`);
    }
  }

  const alias = await createAliasForRoute(context.repositories, {
    workspaceId,
    projectId,
    name: request.name,
    routeId: request.routeId,
    userId,
    description: request.description ?? null,
    gate: request.gate,
    requiresApproval: request.requiresApproval,
  });

  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_alias.created",
    targetType: "model_alias",
    targetId: alias.id,
    metadata: { name: request.name, routeId: request.routeId, projectId },
  });

  return toModelAlias(alias);
}

export async function updateAlias(
  context: ServiceContext,
  workspaceId: string,
  aliasId: string,
  input: UpdateAliasRequest,
): Promise<ModelAlias> {
  const { userId } = await requireModelAction(context, workspaceId, "manage_policy");
  const alias = await requireAlias(context, workspaceId, aliasId);

  await requireAliasGateSuite(context.repositories, workspaceId, input.gate);

  const updated = await context.repositories.modelAliases.update(alias.id, {
    ...(input.description === undefined ? {} : { description: input.description }),
    ...(input.gate === undefined ? {} : { gate: input.gate }),
    ...(input.requiresApproval === undefined ? {} : { requires_approval: input.requiresApproval }),
    updated_by: userId,
  });

  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_alias.updated",
    targetType: "model_alias",
    targetId: alias.id,
    metadata: { ...input },
  });

  return toModelAlias(updated);
}

export async function deleteAlias(
  context: ServiceContext,
  workspaceId: string,
  aliasId: string,
): Promise<{ deleted: true }> {
  const { userId } = await requireModelAction(context, workspaceId, "manage_policy");
  const alias = await requireAlias(context, workspaceId, aliasId);

  await context.repositories.modelAliases.delete(alias.id);
  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_alias.deleted",
    targetType: "model_alias",
    targetId: alias.id,
    metadata: { name: alias.name },
  });

  return { deleted: true };
}

export async function promoteAlias(
  context: ServiceContext,
  workspaceId: string,
  aliasId: string,
  request: PromoteAliasRequest,
): Promise<PromotionResult> {
  const access = await requireModelAction(context, workspaceId, "promote");
  const repositories = context.repositories;
  const alias = await requireAlias(context, workspaceId, aliasId);

  if (request.routeId === alias.route_id && request.canaryPercent === undefined) {
    throw badRequest("The alias already points at this route");
  }

  const { route, gate } = await evaluateAliasTarget(
    repositories,
    workspaceId,
    alias.project_id,
    request.routeId,
    alias.gate,
  );

  if (gate && !gate.passed) {
    const event = await repositories.modelAliases.addEvent({
      aliasId: alias.id,
      kind: "requested",
      fromRouteId: alias.route_id,
      toRouteId: route.id,
      reason: `Gate failed: ${gate.failures.join("; ")}`,
      gate,
      actorUserId: access.userId,
    });

    return {
      alias: toModelAlias(alias),
      outcome: "gate_failed",
      event: toAliasEvent(event),
      decision: null,
    };
  }

  const needsApproval = alias.requires_approval || access.separationOfDuties;
  const [latest] = needsApproval ? await repositories.modelAliases.listEvents(alias.id) : [];
  const hasRequest =
    latest?.kind === "requested" &&
    latest.to_route_id === route.id &&
    latest.from_route_id === alias.route_id;

  if (
    needsApproval &&
    (!access.actions.has("approve") || (access.separationOfDuties && !hasRequest))
  ) {
    const event = await repositories.modelAliases.addEvent({
      aliasId: alias.id,
      kind: "requested",
      fromRouteId: alias.route_id,
      toRouteId: route.id,
      reason: request.reason ?? null,
      gate,
      actorUserId: access.userId,
    });

    return {
      alias: toModelAlias(alias),
      outcome: "awaiting_approval",
      event: toAliasEvent(event),
      decision: null,
    };
  }

  if (access.separationOfDuties && hasRequest && latest.actor_user_id === access.userId) {
    throw conflict(
      "Separation of duties: someone other than the requester must approve this promotion",
    );
  }

  const canary = request.canaryPercent !== undefined && alias.route_id !== null;
  const updated = await repositories.modelAliases.update(
    alias.id,
    canary
      ? {
          canary_route_id: route.id,
          canary_percent: request.canaryPercent ?? 0,
          updated_by: access.userId,
        }
      : { route_id: route.id, canary_route_id: null, canary_percent: 0, updated_by: access.userId },
  );
  const event = await repositories.modelAliases.addEvent({
    aliasId: alias.id,
    kind: canary ? "canary_started" : "promoted",
    fromRouteId: alias.route_id,
    toRouteId: route.id,
    reason: request.reason ?? null,
    gate,
    actorUserId: access.userId,
  });

  await repositories.audit.createRecord({
    workspaceId,
    actorUserId: access.userId,
    action: canary ? "model_alias.canary_started" : "model_alias.promoted",
    targetType: "model_alias",
    targetId: alias.id,
    metadata: {
      from: alias.route_id,
      to: route.id,
      canaryPercent: request.canaryPercent ?? null,
      gate,
    },
  });

  return {
    alias: toModelAlias(updated),
    outcome: canary ? "canary_started" : "promoted",
    event: toAliasEvent(event),
    decision: null,
  };
}

export async function rollbackAlias(
  context: ServiceContext,
  workspaceId: string,
  aliasId: string,
): Promise<ModelAlias> {
  const access = await requireModelAction(context, workspaceId, "promote");
  const { userId } = access;
  const repositories = context.repositories;
  const alias = await requireAlias(context, workspaceId, aliasId);

  if (access.separationOfDuties || (alias.requires_approval && !access.actions.has("approve"))) {
    throw conflict(
      "This rollback needs approval. Request a promotion to the previous route instead",
    );
  }

  if (alias.canary_route_id) {
    if (!alias.route_id) {
      throw conflict("There is no primary route to roll back to");
    }

    const target = await evaluateAliasTarget(
      repositories,
      workspaceId,
      alias.project_id,
      alias.route_id,
      alias.gate,
    );

    if (target.gate && !target.gate.passed) {
      throw conflict(`Gate failed: ${target.gate.failures.join("; ")}`);
    }

    const updated = await repositories.modelAliases.update(alias.id, {
      canary_route_id: null,
      canary_percent: 0,
      updated_by: userId,
    });

    await repositories.modelAliases.addEvent({
      aliasId: alias.id,
      kind: "canary_ended",
      fromRouteId: alias.canary_route_id,
      toRouteId: alias.route_id,
      reason: "Rolled back",
      gate: null,
      actorUserId: userId,
    });

    return toModelAlias(updated);
  }

  const previous = (await repositories.modelAliases.listEvents(alias.id)).find(
    (event) =>
      event.kind === "promoted" && event.to_route_id === alias.route_id && event.from_route_id,
  );

  if (!previous?.from_route_id) {
    throw conflict("There is no earlier route to roll back to");
  }

  const target = await evaluateAliasTarget(
    repositories,
    workspaceId,
    alias.project_id,
    previous.from_route_id,
    alias.gate,
  );

  if (target.gate && !target.gate.passed) {
    throw conflict(`Gate failed: ${target.gate.failures.join("; ")}`);
  }

  const updated = await repositories.modelAliases.update(alias.id, {
    route_id: previous.from_route_id,
    updated_by: userId,
  });

  await repositories.modelAliases.addEvent({
    aliasId: alias.id,
    kind: "rolled_back",
    fromRouteId: alias.route_id,
    toRouteId: previous.from_route_id,
    reason: null,
    gate: null,
    actorUserId: userId,
  });
  await repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_alias.rolled_back",
    targetType: "model_alias",
    targetId: alias.id,
    metadata: { from: alias.route_id, to: previous.from_route_id },
  });

  return toModelAlias(updated);
}

export function chooseAliasRoute(alias: ModelAliasRecord, roll = Math.random()): string | null {
  return pickCanaryRoute(
    alias.canary_route_id
      ? { routeId: alias.canary_route_id, percent: alias.canary_percent }
      : null,
    alias.route_id,
    roll,
  );
}
