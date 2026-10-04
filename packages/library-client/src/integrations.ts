import {
  integrationListResponseSchema,
  integrationResponseSchema,
  integrationReviewResponseSchema,
  type CreateIntegration,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

export async function listNativeIntegrations(
  scope: { workspaceId?: string; projectId?: string } = {},
) {
  const query = new URLSearchParams();

  if (scope.workspaceId) {
    query.set("workspaceId", scope.workspaceId);
  }

  if (scope.projectId) {
    query.set("projectId", scope.projectId);
  }

  const response = await fetchApiOrThrow(`/apps/integrations?${query}`, {
    headers: await apiService.getHeaders(),
  });

  return integrationListResponseSchema.parse(await returnFetchedData<unknown>(response));
}

export async function createNativeIntegration(input: CreateIntegration) {
  const response = await fetchApiOrThrow("/apps/integrations", {
    method: "POST",
    body: input,
    headers: await apiService.getHeaders(),
  });

  return integrationResponseSchema.parse(await returnFetchedData<unknown>(response));
}

export async function connectNativeIntegration(id: string, token?: string) {
  const response = await fetchApiOrThrow(
    `/apps/integrations/${encodeURIComponent(id)}/connection`,
    { method: "PUT", body: { token }, headers: await apiService.getHeaders() },
  );

  return integrationResponseSchema.parse(await returnFetchedData<unknown>(response));
}

export async function disconnectNativeIntegration(id: string) {
  const response = await fetchApiOrThrow(
    `/apps/integrations/${encodeURIComponent(id)}/connection`,
    { method: "DELETE", headers: await apiService.getHeaders() },
  );

  return returnFetchedData<{ success: boolean }>(response);
}

export async function reviewNativeIntegration(id: string) {
  const response = await fetchApiOrThrow(`/apps/integrations/${encodeURIComponent(id)}/review`, {
    method: "POST",
    headers: await apiService.getHeaders(),
  });

  return integrationReviewResponseSchema.parse(await returnFetchedData<unknown>(response));
}

export async function refreshNativeIntegration(input: {
  id: string;
  expectedRevision: number;
  expectedDigest: string;
}) {
  const response = await fetchApiOrThrow(
    `/apps/integrations/${encodeURIComponent(input.id)}/revisions`,
    {
      method: "POST",
      body: { expectedRevision: input.expectedRevision, expectedDigest: input.expectedDigest },
      headers: await apiService.getHeaders(),
    },
  );

  return integrationResponseSchema.parse(await returnFetchedData<unknown>(response));
}

export async function revokeNativeIntegration(id: string) {
  const response = await fetchApiOrThrow(`/apps/integrations/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await apiService.getHeaders(),
  });

  return returnFetchedData<{ success: boolean }>(response);
}
