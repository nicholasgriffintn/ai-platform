import {
  createOidcConnectionSchema,
  updateOidcConnectionSchema,
  oidcConnectionResponseSchema,
  linkedOidcIdentitiesResponseSchema,
  oidcConnectionParamsSchema,
  type CreateOidcConnection,
  type UpdateOidcConnection,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { API_BASE_URL } from "./constants.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

export function enterpriseIdentityUrls(connectionId: string) {
  const { connectionId: id } = oidcConnectionParamsSchema.parse({ connectionId });
  const signIn = new URL(`auth/enterprise/${id}`, API_BASE_URL + "/");
  const link = new URL(signIn);

  link.searchParams.set("link", "true");

  return { signIn: signIn.href, link: link.href, callback: signIn.href + "/callback" };
}

export async function getWorkspaceIdentity(workspaceId: string) {
  const response = await fetchApiOrThrow(
    `/workspaces/${encodeURIComponent(workspaceId)}/identity`,
    {
      headers: await apiService.getHeaders(),
    },
  );

  return oidcConnectionResponseSchema.parse(await returnFetchedData<unknown>(response));
}

export async function createWorkspaceIdentity(workspaceId: string, input: CreateOidcConnection) {
  const response = await fetchApiOrThrow(
    `/workspaces/${encodeURIComponent(workspaceId)}/identity`,
    {
      method: "POST",
      headers: await apiService.getHeaders(),
      body: createOidcConnectionSchema.parse(input),
    },
  );

  return oidcConnectionResponseSchema.parse(await returnFetchedData<unknown>(response));
}

export async function updateWorkspaceIdentity(workspaceId: string, input: UpdateOidcConnection) {
  const response = await fetchApiOrThrow(
    `/workspaces/${encodeURIComponent(workspaceId)}/identity`,
    {
      method: "PATCH",
      headers: await apiService.getHeaders(),
      body: updateOidcConnectionSchema.parse(input),
    },
  );

  return oidcConnectionResponseSchema.parse(await returnFetchedData<unknown>(response));
}

export async function deleteWorkspaceIdentity(workspaceId: string): Promise<void> {
  await fetchApiOrThrow(`/workspaces/${encodeURIComponent(workspaceId)}/identity`, {
    method: "DELETE",
    headers: await apiService.getHeaders(),
  });
}

export async function listLinkedEnterpriseIdentities() {
  const response = await fetchApiOrThrow("/auth/enterprise/connections", {
    headers: await apiService.getHeaders(),
  });

  return linkedOidcIdentitiesResponseSchema.parse(await returnFetchedData<unknown>(response));
}
