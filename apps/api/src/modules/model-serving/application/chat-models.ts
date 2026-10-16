import {
  findModelConfigByMatchingModel,
  getModelConfigById,
} from "@ngriffin_uk/polychat-ai-models";
import {
  aliasChatModelId,
  deploymentChatModelId,
  type ModelConfig,
  type ModelConfigItem,
  parsePlatformChatModelId,
  PLATFORM_DEPLOYMENT_CHAT_PROVIDER,
} from "@ngriffin_uk/polychat-schemas";

import { hasD1DatabaseBinding } from "~/infrastructure/database/bindings";
import { createRepositories, type Repositories } from "~/infrastructure/database/repositories";
import { loadRegistryScope, routeStanding } from "~/modules/model-registry/application/scope";
import { ModelRouteRepository } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import type { ModelRouteRecord } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import { ModelAliasRepository } from "~/modules/model-serving/infrastructure/ModelAliasRepository";
import { ModelDeploymentRepository } from "~/modules/model-serving/infrastructure/ModelDeploymentRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";
import type { IEnv } from "~/types";

import type { ModelAliasRecord } from "../infrastructure/ModelAliasRepository";
import type { ModelDeploymentRecord } from "../infrastructure/ModelDeploymentRepository";
import { chooseAliasRoute } from "./aliases";
import { isDeploymentInvocable } from "./deployment-state";

function deploymentConfig(deployment: ModelDeploymentRecord, name: string): ModelConfigItem {
  return {
    id: deploymentChatModelId(deployment.id),
    matchingModel: deploymentChatModelId(deployment.id),
    name,
    description: `${deployment.name} on ${deployment.provider} (${deployment.status.replace(/_/g, " ")})`,
    provider: PLATFORM_DEPLOYMENT_CHAT_PROVIDER,
    supportsStreaming: false,
    supportsTemperature: true,
    supportsTopP: true,
    modalities: { input: ["text"], output: ["text"] },
  };
}

async function routeConfig(
  repositories: Repositories,
  route: ModelRouteRecord,
  name: string,
): Promise<ModelConfigItem | null> {
  if (route.status !== "active") {
    return null;
  }

  if (route.deployment_id) {
    const deployment = await repositories
      .get(ModelDeploymentRepository)
      .get(route.workspace_id, route.deployment_id);

    return deployment && isDeploymentInvocable(deployment)
      ? deploymentConfig(deployment, name)
      : null;
  }

  const catalogue =
    getModelConfigById(route.provider_model_id) ??
    findModelConfigByMatchingModel(route.provider_model_id, route.provider);

  return catalogue && catalogue.provider === route.provider
    ? { ...catalogue, id: route.provider_model_id, name }
    : null;
}

async function memberWorkspaceIds(repositories: Repositories, userId: number): Promise<string[]> {
  return (await repositories.get(WorkspaceRepository).listWorkspaces(userId)).map(
    (workspace) => workspace.id,
  );
}

async function deploymentHasApproval(
  repositories: Repositories,
  deployment: ModelDeploymentRecord,
): Promise<boolean> {
  if (!isDeploymentInvocable(deployment) || !deployment.route_id) {
    return false;
  }

  const route = await repositories
    .get(ModelRouteRepository)
    .getRoute(deployment.workspace_id, deployment.route_id);

  if (
    !route ||
    route.deployment_id !== deployment.id ||
    route.version_id !== deployment.version_id
  ) {
    return false;
  }

  const scope = await loadRegistryScope(
    repositories,
    deployment.workspace_id,
    deployment.project_id,
    { versionIds: [route.version_id] },
  );

  return routeStanding(scope, route)?.usable === true;
}

async function aliasConfig(
  repositories: Repositories,
  alias: ModelAliasRecord,
): Promise<ModelConfigItem | null> {
  const routeId = chooseAliasRoute(alias);
  const route = routeId
    ? await repositories.get(ModelRouteRepository).getRoute(alias.workspace_id, routeId)
    : null;

  if (!route) {
    return null;
  }

  const scope = await loadRegistryScope(repositories, alias.workspace_id, alias.project_id, {
    versionIds: [route.version_id],
  });

  return routeStanding(scope, route)?.usable ? routeConfig(repositories, route, alias.name) : null;
}

export async function listPlatformChatModels(
  env: IEnv | undefined,
  userId: number | undefined,
): Promise<ModelConfig> {
  if (!hasD1DatabaseBinding(env) || !userId) {
    return {};
  }

  const repositories = createRepositories(env);
  const aliases = await repositories
    .get(ModelAliasRepository)
    .listForMember(await memberWorkspaceIds(repositories, userId));
  const configs: ModelConfig = {};

  for (const alias of aliases) {
    const config = await aliasConfig(repositories, {
      ...alias,
      canary_route_id: null,
      canary_percent: 0,
    });

    if (config) {
      configs[aliasChatModelId(alias.id)] = config;
    }
  }

  return configs;
}

export async function findPlatformChatModel(
  model: string,
  env: IEnv | undefined,
  userId: number | undefined,
): Promise<ModelConfigItem | null> {
  const parsed = parsePlatformChatModelId(model);

  if (!parsed || !hasD1DatabaseBinding(env) || !userId) {
    return null;
  }

  const repositories = createRepositories(env);
  const workspaces = new Set(await memberWorkspaceIds(repositories, userId));

  if (parsed.kind === "alias") {
    const alias = await repositories.get(ModelAliasRepository).getById(parsed.id);

    return alias && workspaces.has(alias.workspace_id) ? aliasConfig(repositories, alias) : null;
  }

  const deployment = await repositories.get(ModelDeploymentRepository).getById(parsed.id);

  return deployment &&
    workspaces.has(deployment.workspace_id) &&
    (await deploymentHasApproval(repositories, deployment))
    ? deploymentConfig(deployment, deployment.name)
    : null;
}

export async function canUserInvokeDeployment(
  env: IEnv,
  userId: number,
  deploymentId: string,
): Promise<ModelDeploymentRecord | null> {
  const repositories = createRepositories(env);
  const deployment = await repositories.get(ModelDeploymentRepository).getById(deploymentId);

  if (!deployment) {
    return null;
  }

  return (await repositories
    .get(WorkspaceRepository)
    .getMembership(deployment.workspace_id, userId)) &&
    (await deploymentHasApproval(repositories, deployment))
    ? deployment
    : null;
}
