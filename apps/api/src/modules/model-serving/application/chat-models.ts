import {
  findModelConfigByMatchingModel,
  getModelConfigById,
} from "@ngriffin_uk/polychat-ai-models";
import {
  aliasChatModelId,
  type ModelConfig,
  type ModelConfigItem,
  parsePlatformChatModelId,
  PLATFORM_DEPLOYMENT_CHAT_PROVIDER,
} from "@ngriffin_uk/polychat-schemas";

import { hasD1DatabaseBinding } from "~/infrastructure/database/bindings";
import { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import type { ModelRouteRecord } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import type { IEnv } from "~/types";

import type { ModelAliasRecord } from "../infrastructure/ModelAliasRepository";
import type { ModelDeploymentRecord } from "../infrastructure/ModelDeploymentRepository";
import { chooseAliasRoute } from "./aliases";

const SERVING_STATUSES = new Set(["running", "scaled_to_zero", "updating", "provisioning"]);

function deploymentConfig(deployment: ModelDeploymentRecord, name: string): ModelConfigItem {
  return {
    matchingModel: `deployment:${deployment.id}`,
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
  repositories: RepositoryManager,
  route: ModelRouteRecord,
  name: string,
): Promise<ModelConfigItem | null> {
  if (route.status !== "active") {
    return null;
  }

  if (route.deployment_id) {
    const deployment = await repositories.modelDeployments.getById(route.deployment_id);

    return deployment &&
      SERVING_STATUSES.has(deployment.status) &&
      deployment.desired_state === "running"
      ? deploymentConfig(deployment, name)
      : null;
  }

  const catalogue =
    getModelConfigById(route.provider_model_id) ??
    findModelConfigByMatchingModel(route.provider_model_id, route.provider);

  return catalogue && catalogue.provider === route.provider ? { ...catalogue, name } : null;
}

async function memberWorkspaceIds(
  repositories: RepositoryManager,
  userId: number,
): Promise<string[]> {
  return (await repositories.workspaces.listWorkspaces(userId)).map((workspace) => workspace.id);
}

async function aliasConfig(
  repositories: RepositoryManager,
  alias: ModelAliasRecord,
): Promise<ModelConfigItem | null> {
  const routeId = chooseAliasRoute(alias);
  const route = routeId ? await repositories.modelRoutes.getRouteById(routeId) : null;

  return route ? routeConfig(repositories, route, alias.name) : null;
}

export async function listPlatformChatModels(
  env: IEnv | undefined,
  userId: number | undefined,
): Promise<ModelConfig> {
  if (!hasD1DatabaseBinding(env) || !userId) {
    return {};
  }

  const repositories = RepositoryManager.getInstance(env);
  const aliases = await repositories.modelAliases.listForMember(
    await memberWorkspaceIds(repositories, userId),
  );
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

  const repositories = RepositoryManager.getInstance(env);
  const workspaces = new Set(await memberWorkspaceIds(repositories, userId));

  if (parsed.kind === "alias") {
    const alias = await repositories.modelAliases.getById(parsed.id);

    return alias && workspaces.has(alias.workspace_id) ? aliasConfig(repositories, alias) : null;
  }

  const deployment = await repositories.modelDeployments.getById(parsed.id);

  return deployment &&
    workspaces.has(deployment.workspace_id) &&
    SERVING_STATUSES.has(deployment.status)
    ? deploymentConfig(deployment, deployment.name)
    : null;
}

export async function canUserInvokeDeployment(
  env: IEnv,
  userId: number,
  deploymentId: string,
): Promise<ModelDeploymentRecord | null> {
  const repositories = RepositoryManager.getInstance(env);
  const deployment = await repositories.modelDeployments.getById(deploymentId);

  if (!deployment) {
    return null;
  }

  return (await repositories.workspaces.getMembership(deployment.workspace_id, userId))
    ? deployment
    : null;
}
