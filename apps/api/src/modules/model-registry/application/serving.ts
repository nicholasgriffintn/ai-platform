import { getModels } from "@ngriffin_uk/polychat-ai-models";
import {
  matchesSourceReference,
  resolveProviderRegion,
} from "@ngriffin_uk/polychat-library-model-registry";
import type {
  CreateRouteRequest,
  ModelRoute,
  RouteSuggestion,
  RoutesResponse,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { findModelConfig } from "~/modules/models/application/resolve";

import {
  notFound,
  requireRegistryGovernor,
  requireRegistryMember,
  requireWorkspaceProject,
} from "./access";
import { deleteEndpoint } from "./endpoints";
import { toModelRoute } from "./mappers";
import { loadRegistryScope, routeStanding } from "./scope";

export async function suggestRoutes(
  context: ServiceContext,
  workspaceId: string,
  versionId: string,
): Promise<{ suggestions: RouteSuggestion[] }> {
  await requireRegistryMember(context, workspaceId);

  const repositories = context.repositories;
  const version = await repositories.modelAssets.getVersion(workspaceId, versionId);
  const asset = version
    ? await repositories.modelAssets.getAsset(workspaceId, version.asset_id)
    : null;

  if (!version || !asset) {
    throw notFound("Model version");
  }

  const existing = await repositories.modelRoutes.listRoutes(workspaceId, {
    versionIds: [versionId],
  });
  const registered = new Set(
    existing.map((route) => `${route.provider}:${route.provider_model_id}`),
  );

  return {
    suggestions: Object.entries(getModels())
      .filter(
        ([, model]) =>
          typeof model.matchingModel === "string" &&
          matchesSourceReference(model.matchingModel, asset.source_ref),
      )
      .map(([id, model]) => ({
        provider: model.provider,
        providerModelId: id,
        name: model.name ?? id,
        region: resolveProviderRegion(model.provider),
        registered: registered.has(`${model.provider}:${id}`),
      })),
  };
}

export async function createRoute(
  context: ServiceContext,
  workspaceId: string,
  input: CreateRouteRequest,
): Promise<ModelRoute> {
  const { userId } = await requireRegistryMember(context, workspaceId);
  const repositories = context.repositories;
  const version = await repositories.modelAssets.getVersion(workspaceId, input.versionId);

  if (!version) {
    throw notFound("Model version");
  }

  const model = await findModelConfig(input.providerModelId, context.env, input.provider, userId);

  if (!model || model.provider !== input.provider) {
    throw new AssistantError(
      `${input.provider} does not serve ${input.providerModelId}`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const route = await repositories.modelRoutes.createRoute({
    workspaceId,
    versionId: version.id,
    provider: input.provider,
    providerModelId: input.providerModelId,
    region: input.region,
    weightsVerified: input.weightsVerified,
    createdBy: userId,
  });

  await repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_route.registered",
    targetType: "model_route",
    targetId: route.id,
    metadata: {
      versionId: version.id,
      provider: route.provider,
      providerModelId: route.provider_model_id,
      region: route.region,
      weightsVerified: route.weights_verified,
    },
  });

  return toModelRoute(route);
}

export async function listRoutes(
  context: ServiceContext,
  workspaceId: string,
  projectIdInput?: string,
): Promise<RoutesResponse> {
  await requireRegistryMember(context, workspaceId);

  const projectId = await requireWorkspaceProject(context, workspaceId, projectIdInput);
  const scope = await loadRegistryScope(context.repositories, workspaceId, projectId);

  return {
    routes: scope.routes.flatMap((route) => {
      const version = scope.versions.find((item) => item.id === route.version_id);
      const asset = version ? scope.assets.get(version.asset_id) : undefined;

      return asset
        ? [
            {
              ...toModelRoute(route),
              displayName: asset.display_name,
              approved: routeStanding(scope, route)?.usable === true,
            },
          ]
        : [];
    }),
  };
}

export async function retireRoute(
  context: ServiceContext,
  workspaceId: string,
  routeId: string,
): Promise<ModelRoute> {
  const { userId } = await requireRegistryGovernor(context, workspaceId);
  const route = await context.repositories.modelRoutes.getRoute(workspaceId, routeId);

  if (!route) {
    throw notFound("Route");
  }

  const removal = await deleteEndpoint(context.env, context.repositories, route);

  await context.repositories.modelRoutes.setStatus(routeId, "retired");
  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_route.retired",
    targetType: "model_route",
    targetId: routeId,
    metadata: {
      versionId: route.version_id,
      provider: route.provider,
      ...(removal
        ? { endpointDeleted: removal.providerDeleted, endpointError: removal.error }
        : {}),
    },
  });

  return toModelRoute({ ...route, status: "retired" });
}
