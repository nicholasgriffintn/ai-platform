import type {
  BomFormat,
  ConnectionCheck,
  ModelAuditQuery,
  ModelBudget,
  ModelConnection,
  ModelInventoryItem,
  ModelPermissions,
  ModelProviderId,
  ModelsOverview,
  MyModelPermissions,
  ProviderCatalogueResponse,
  ResolveSpendRequest,
  RevocationResult,
  RevokeVersionRequest,
  SaveBudgetRequest,
  SaveModelConnectionRequest,
  SaveModelPermissionsRequest,
  SpendRequest,
  SpendSummary,
  TrainingContentSummary,
  WorkspaceAuditRecord,
} from "@ngriffin_uk/polychat-schemas";
import { toQueryString } from "@ngriffin_uk/polychat-utility-core";

import { platformRequest, segment, workspacePath } from "./request.js";

export function getModelsOverview(
  workspaceId: string,
  projectId?: string,
): Promise<ModelsOverview> {
  return platformRequest(workspacePath(workspaceId, `/overview${toQueryString({ projectId })}`));
}

export function listModelProviders(workspaceId: string): Promise<ProviderCatalogueResponse> {
  return platformRequest(workspacePath(workspaceId, "/providers"));
}

export function checkModelProvider(
  workspaceId: string,
  provider: ModelProviderId,
  input: SaveModelConnectionRequest,
): Promise<ConnectionCheck> {
  return platformRequest(workspacePath(workspaceId, `/providers/${segment(provider)}/check`), {
    method: "POST",
    body: input,
  });
}

export function saveModelProvider(
  workspaceId: string,
  provider: ModelProviderId,
  input: SaveModelConnectionRequest,
): Promise<ModelConnection> {
  return platformRequest(workspacePath(workspaceId, `/providers/${segment(provider)}`), {
    method: "PUT",
    body: input,
  });
}

export function deleteModelProvider(
  workspaceId: string,
  provider: ModelProviderId,
): Promise<{ deleted: boolean }> {
  return platformRequest(workspacePath(workspaceId, `/providers/${segment(provider)}`), {
    method: "DELETE",
  });
}

export function getModelPermissions(workspaceId: string): Promise<ModelPermissions> {
  return platformRequest(workspacePath(workspaceId, "/permissions"));
}

export function getMyModelPermissions(workspaceId: string): Promise<MyModelPermissions> {
  return platformRequest(workspacePath(workspaceId, "/permissions/me"));
}

export function saveModelPermissions(
  workspaceId: string,
  input: SaveModelPermissionsRequest,
): Promise<ModelPermissions> {
  return platformRequest(workspacePath(workspaceId, "/permissions"), {
    method: "PUT",
    body: input,
  });
}

export function getModelSpend(workspaceId: string): Promise<SpendSummary> {
  return platformRequest(workspacePath(workspaceId, "/spend"));
}

export function saveModelBudget(
  workspaceId: string,
  input: SaveBudgetRequest,
): Promise<ModelBudget> {
  return platformRequest(workspacePath(workspaceId, "/budgets"), { method: "PUT", body: input });
}

export async function deleteModelBudget(workspaceId: string, projectId?: string): Promise<void> {
  await platformRequest(workspacePath(workspaceId, `/budgets${toQueryString({ projectId })}`), {
    method: "DELETE",
  });
}

export async function listSpendRequests(workspaceId: string): Promise<SpendRequest[]> {
  return (
    await platformRequest<{ requests: SpendRequest[] }>(
      workspacePath(workspaceId, "/spend-requests"),
    )
  ).requests;
}

export function resolveSpendRequest(
  workspaceId: string,
  requestId: string,
  input: ResolveSpendRequest,
): Promise<SpendRequest> {
  return platformRequest(
    workspacePath(workspaceId, `/spend-requests/${segment(requestId)}/resolve`),
    {
      method: "POST",
      body: input,
    },
  );
}

export async function listModelAudit(
  workspaceId: string,
  params: Partial<ModelAuditQuery> = {},
): Promise<WorkspaceAuditRecord[]> {
  return (
    await platformRequest<{ events: WorkspaceAuditRecord[] }>(
      workspacePath(workspaceId, `/audit${toQueryString(params)}`),
    )
  ).events;
}

export function exportModelInventory(
  workspaceId: string,
): Promise<{ generatedAt: string; items: ModelInventoryItem[] }> {
  return platformRequest(workspacePath(workspaceId, "/inventory"));
}

export function revokeModelVersion(
  workspaceId: string,
  versionId: string,
  input: RevokeVersionRequest,
): Promise<RevocationResult> {
  return platformRequest(workspacePath(workspaceId, `/versions/${segment(versionId)}/revoke`), {
    method: "POST",
    body: input,
  });
}

export function exportModelBom(
  workspaceId: string,
  versionId: string,
  params: { format: BomFormat; routeId?: string },
): Promise<Record<string, unknown>> {
  return platformRequest(
    workspacePath(workspaceId, `/versions/${segment(versionId)}/bom${toQueryString(params)}`),
  );
}

export function exportModelCard(
  workspaceId: string,
  versionId: string,
): Promise<{ markdown: string }> {
  return platformRequest(workspacePath(workspaceId, `/versions/${segment(versionId)}/card`));
}

export function exportTrainingContentSummary(
  workspaceId: string,
  versionId: string,
): Promise<TrainingContentSummary> {
  return platformRequest(
    workspacePath(workspaceId, `/versions/${segment(versionId)}/training-content`),
  );
}
