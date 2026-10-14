import {
  approvalSchema,
  type RecipeConnectorAccount,
  type RecipeConnectorAccountUpdateRequest,
  type RecipeConnectorApiKeyRequest,
  type RecipeConnectorProvider,
  type RecipeConnectorsResponse,
  type RecipeConnectorStartResponse,
} from "@ngriffin_uk/polychat-schemas";

import { requestJson, resource } from "./resource.js";

function connectorPath(provider: RecipeConnectorProvider, suffix = ""): string {
  return `/connectors/${encodeURIComponent(provider)}${suffix}`;
}

export async function listRecipeConnectors(): Promise<RecipeConnectorsResponse> {
  return {
    connectors:
      await resource<RecipeConnectorsResponse["connectors"][number]>("/connectors").listAll(),
  };
}

export function startRecipeConnector(
  provider: RecipeConnectorProvider,
  returnTo?: string,
  authConfigId?: string,
): Promise<RecipeConnectorStartResponse> {
  return requestJson<RecipeConnectorStartResponse>(connectorPath(provider, "/connect"), "POST", {
    returnTo,
    authConfigId,
  });
}

export function storeRecipeConnectorApiKey(
  provider: RecipeConnectorProvider,
  request: RecipeConnectorApiKeyRequest,
): Promise<{ success: boolean }> {
  return requestJson<{ success: boolean }>(connectorPath(provider, "/api_key"), "POST", request);
}

export function disconnectRecipeConnector(
  provider: RecipeConnectorProvider,
): Promise<{ success: boolean }> {
  return requestJson<{ success: boolean }>(connectorPath(provider), "DELETE");
}

export async function listRecipeConnectorAccounts(
  provider: RecipeConnectorProvider,
): Promise<{ accounts: RecipeConnectorAccount[] }> {
  return {
    accounts: await resource<RecipeConnectorAccount>(
      connectorPath(provider, "/accounts"),
    ).listAll(),
  };
}

export function updateRecipeConnectorAccount(
  provider: RecipeConnectorProvider,
  request: RecipeConnectorAccountUpdateRequest,
): Promise<RecipeConnectorAccount> {
  const { accountId, ...update } = request;

  return requestJson<RecipeConnectorAccount>(
    connectorPath(provider, `/accounts/${encodeURIComponent(accountId)}`),
    "PATCH",
    update,
  );
}

export async function resolveConnectorOperationApproval(
  approvalId: string,
  resolution: "approved" | "rejected",
): Promise<{ approval: { id: string; state: "approved" | "rejected" } }> {
  const approval = approvalSchema.parse(
    await requestJson<unknown>(`/approvals/${encodeURIComponent(approvalId)}`, "PATCH", {
      state: resolution,
    }),
  );

  return { approval: { id: approval.id, state: resolution } };
}
