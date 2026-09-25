import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { TrainingDeploymentDeleteResponse } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

import { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import {
  deleteTrainingWorkerDeployment,
  getTrainingWorkerDeployment,
} from "~/modules/training/infrastructure/trainingWorkerClient";
import type { IEnv } from "~/types";

import type { ModelRouteRecord } from "../infrastructure/ModelRouteRepository";
import { resolveEndpointCredentials, resolveHuggingFace } from "./credentials";

export const HUGGINGFACE_ENDPOINT_ROUTE_PROVIDER = "huggingface-endpoint";

const logger = getLogger({ prefix: "modules/model-registry/endpoints" });

function endpointOf(route: ModelRouteRecord) {
  return route.provider === HUGGINGFACE_ENDPOINT_ROUTE_PROVIDER &&
    route.deployment_ref &&
    route.created_by
    ? { name: route.deployment_ref, owner: route.created_by }
    : null;
}

export async function refreshEndpoint(
  env: IEnv,
  repositories: RepositoryManager,
  route: ModelRouteRecord,
): Promise<void> {
  const endpoint = endpointOf(route);

  if (!endpoint) {
    return;
  }

  try {
    await getTrainingWorkerDeployment(
      env,
      "huggingface",
      endpoint.name,
      endpoint.owner,
      await resolveEndpointCredentials(env, repositories, route.workspace_id),
    );
  } catch (error) {
    logger.warn("Refreshing the Inference Endpoint failed", {
      endpointName: endpoint.name,
      error: getErrorMessage(error, "unknown error"),
    });
  }
}

export async function deleteEndpoint(
  env: IEnv,
  repositories: RepositoryManager,
  route: ModelRouteRecord,
): Promise<TrainingDeploymentDeleteResponse | null> {
  const endpoint = endpointOf(route);

  if (!endpoint) {
    return null;
  }

  return deleteTrainingWorkerDeployment(
    env,
    "huggingface",
    endpoint.name,
    endpoint.owner,
    await resolveEndpointCredentials(env, repositories, route.workspace_id),
  );
}

export async function resolveEndpointToken(
  env: IEnv,
  endpointName: string,
): Promise<string | undefined> {
  const repositories = RepositoryManager.getInstance(env);
  const route = await repositories.modelRoutes.getRouteByDeployment(
    HUGGINGFACE_ENDPOINT_ROUTE_PROVIDER,
    endpointName,
  );

  if (!route) {
    return env.HUGGINGFACE_TOKEN;
  }

  return (await resolveHuggingFace(env, repositories, route.workspace_id)).token;
}
