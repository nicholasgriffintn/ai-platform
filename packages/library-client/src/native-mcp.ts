import {
  createNativeMcpServerSchema,
  updateNativeMcpServerSchema,
  connectNativeMcpServerSchema,
  nativeMcpServerSchema,
  nativeMcpServerListSchema,
  type CreateNativeMcpServer,
  type UpdateNativeMcpServer,
  type ConnectNativeMcpServer,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

const ROOT = "/apps/mcp";

export async function discoverNativeMcpServer(id: string, revision: number) {
  const response = await fetchApiOrThrow(`${ROOT}/${encodeURIComponent(id)}/discover`, {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: { revision },
  });

  return nativeMcpServerSchema.parse(await returnFetchedData<unknown>(response));
}

export async function listNativeMcpServers(workspaceId?: string) {
  const response = await fetchApiOrThrow(
    ROOT + (workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ""),
    { headers: await apiService.getHeaders() },
  );

  return nativeMcpServerListSchema.parse(await returnFetchedData<unknown>(response)).servers;
}

export async function createNativeMcpServer(input: CreateNativeMcpServer) {
  const response = await fetchApiOrThrow(ROOT, {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: createNativeMcpServerSchema.parse(input),
  });

  return nativeMcpServerSchema.parse(await returnFetchedData<unknown>(response));
}

export async function updateNativeMcpServer(id: string, input: UpdateNativeMcpServer) {
  const response = await fetchApiOrThrow(`${ROOT}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: await apiService.getHeaders(),
    body: updateNativeMcpServerSchema.parse(input),
  });

  return nativeMcpServerSchema.parse(await returnFetchedData<unknown>(response));
}

export async function deleteNativeMcpServer(id: string, revision: number) {
  await fetchApiOrThrow(`${ROOT}/${encodeURIComponent(id)}?revision=${revision}`, {
    method: "DELETE",
    headers: await apiService.getHeaders(),
  });
}

export async function connectNativeMcpServer(id: string, input: ConnectNativeMcpServer) {
  const response = await fetchApiOrThrow(`${ROOT}/${encodeURIComponent(id)}/connection`, {
    method: "PUT",
    headers: await apiService.getHeaders(),
    body: connectNativeMcpServerSchema.parse(input),
  });

  return nativeMcpServerSchema.parse(await returnFetchedData<unknown>(response));
}

export async function disconnectNativeMcpServer(id: string) {
  await fetchApiOrThrow(`${ROOT}/${encodeURIComponent(id)}/connection`, {
    method: "DELETE",
    headers: await apiService.getHeaders(),
  });
}
