import type {
  AliasDetail,
  AliasesResponse,
  CreateAliasRequest,
  CreateDeploymentRequest,
  CreateRouteRequest,
  DeploymentAction,
  DeploymentDetail,
  DeploymentPlan,
  DeploymentPlanRequest,
  DeploymentsResponse,
  DeploymentStartResult,
  ModelAlias,
  ModelDeployment,
  ModelRoute,
  PlaygroundRequest,
  PlaygroundResponse,
  PromoteAliasRequest,
  PromotionResult,
  RouteHealth,
  RoutesResponse,
  RouteSuggestion,
  ScaleDeploymentRequest,
  UpdateAliasRequest,
} from "@ngriffin_uk/polychat-schemas";
import { toQueryString } from "@ngriffin_uk/polychat-utility-core";

import { platformRequest, segment, workspacePath } from "./request.js";

export function planDeployment(
  workspaceId: string,
  input: DeploymentPlanRequest,
): Promise<DeploymentPlan> {
  return platformRequest(workspacePath(workspaceId, "/deployments/plan"), {
    method: "POST",
    body: input,
  });
}

export async function listDeployments(
  workspaceId: string,
  projectId?: string,
): Promise<DeploymentsResponse["deployments"]> {
  return (
    await platformRequest<DeploymentsResponse>(
      workspacePath(workspaceId, `/deployments${toQueryString({ projectId })}`),
    )
  ).deployments;
}

export function createDeployment(
  workspaceId: string,
  input: CreateDeploymentRequest,
): Promise<DeploymentStartResult> {
  return platformRequest(workspacePath(workspaceId, "/deployments"), {
    method: "POST",
    body: input,
  });
}

export function getDeployment(
  workspaceId: string,
  deploymentId: string,
): Promise<DeploymentDetail> {
  return platformRequest(workspacePath(workspaceId, `/deployments/${segment(deploymentId)}`));
}

export function scaleDeployment(
  workspaceId: string,
  deploymentId: string,
  input: ScaleDeploymentRequest,
): Promise<ModelDeployment> {
  return platformRequest(
    workspacePath(workspaceId, `/deployments/${segment(deploymentId)}/scale`),
    {
      method: "POST",
      body: input,
    },
  );
}

export function changeDeploymentState(
  workspaceId: string,
  deploymentId: string,
  action: DeploymentAction,
): Promise<ModelDeployment> {
  return platformRequest(
    workspacePath(workspaceId, `/deployments/${segment(deploymentId)}/${action}`),
    {
      method: "POST",
    },
  );
}

export function runDeploymentPlayground(
  workspaceId: string,
  deploymentId: string,
  input: PlaygroundRequest,
): Promise<PlaygroundResponse> {
  return platformRequest(
    workspacePath(workspaceId, `/deployments/${segment(deploymentId)}/playground`),
    {
      method: "POST",
      body: input,
    },
  );
}

export async function listAliases(
  workspaceId: string,
  projectId?: string,
): Promise<AliasesResponse["aliases"]> {
  return (
    await platformRequest<AliasesResponse>(
      workspacePath(workspaceId, `/aliases${toQueryString({ projectId })}`),
    )
  ).aliases;
}

export function createAlias(workspaceId: string, input: CreateAliasRequest): Promise<ModelAlias> {
  return platformRequest(workspacePath(workspaceId, "/aliases"), { method: "POST", body: input });
}

export function getAlias(workspaceId: string, aliasId: string): Promise<AliasDetail> {
  return platformRequest(workspacePath(workspaceId, `/aliases/${segment(aliasId)}`));
}

export function updateAlias(
  workspaceId: string,
  aliasId: string,
  input: UpdateAliasRequest,
): Promise<ModelAlias> {
  return platformRequest(workspacePath(workspaceId, `/aliases/${segment(aliasId)}`), {
    method: "PUT",
    body: input,
  });
}

export async function deleteAlias(workspaceId: string, aliasId: string): Promise<void> {
  await platformRequest(workspacePath(workspaceId, `/aliases/${segment(aliasId)}`), {
    method: "DELETE",
  });
}

export function promoteAlias(
  workspaceId: string,
  aliasId: string,
  input: PromoteAliasRequest,
): Promise<PromotionResult> {
  return platformRequest(workspacePath(workspaceId, `/aliases/${segment(aliasId)}/promote`), {
    method: "POST",
    body: input,
  });
}

export function rollbackAlias(workspaceId: string, aliasId: string): Promise<ModelAlias> {
  return platformRequest(workspacePath(workspaceId, `/aliases/${segment(aliasId)}/rollback`), {
    method: "POST",
  });
}

export async function listModelRoutes(
  workspaceId: string,
  projectId?: string,
): Promise<RoutesResponse["routes"]> {
  return (
    await platformRequest<RoutesResponse>(
      workspacePath(workspaceId, `/routes${toQueryString({ projectId })}`),
    )
  ).routes;
}

export function createModelRoute(
  workspaceId: string,
  input: CreateRouteRequest,
): Promise<ModelRoute> {
  return platformRequest(workspacePath(workspaceId, "/routes"), { method: "POST", body: input });
}

export function retireModelRoute(workspaceId: string, routeId: string): Promise<ModelRoute> {
  return platformRequest(workspacePath(workspaceId, `/routes/${segment(routeId)}/retire`), {
    method: "POST",
  });
}

export function getModelRouteHealth(workspaceId: string, routeId: string): Promise<RouteHealth> {
  return platformRequest(workspacePath(workspaceId, `/routes/${segment(routeId)}/health`));
}

export async function listRouteSuggestions(
  workspaceId: string,
  versionId: string,
): Promise<RouteSuggestion[]> {
  return (
    await platformRequest<{ suggestions: RouteSuggestion[] }>(
      workspacePath(workspaceId, `/versions/${segment(versionId)}/route-suggestions`),
    )
  ).suggestions;
}
