import { apiService } from "../api-service.js";
import { fetchApiOrThrow } from "../fetch-wrapper.js";
import { returnFetchedData } from "../http.js";

export async function platformRequest<T>(
  path: string,
  init: { method?: string; body?: object | Blob; contentType?: string } = {},
): Promise<T> {
  const headers = await apiService.getHeaders();
  const response = await fetchApiOrThrow(`/model-platform${path}`, {
    method: init.method ?? "GET",
    headers: init.contentType ? { ...headers, "Content-Type": init.contentType } : headers,
    body: init.body,
    ...(init.body instanceof Blob ? { timeoutMs: null } : {}),
  });

  return returnFetchedData<T>(response);
}

export function workspacePath(workspaceId: string, path = ""): string {
  return `/workspaces/${encodeURIComponent(workspaceId)}${path}`;
}

export function segment(value: string): string {
  return encodeURIComponent(value);
}
