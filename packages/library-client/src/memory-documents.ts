import type {
  CreateMemoryDocumentInput,
  MemoryDocument,
  MemoryDocumentSummary,
  UpdateMemoryDocumentInput,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service";
import { fetchApiOrThrow } from "./fetch-wrapper";
import { returnFetchedData } from "./http";

const BASE_PATH = "/memory/documents";

function scopeQuery(projectId?: string): string {
  return projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
}

export async function listMemoryDocuments(projectId?: string) {
  const response = await fetchApiOrThrow(`${BASE_PATH}${scopeQuery(projectId)}`, {
    method: "GET",
    headers: await apiService.getHeaders(),
  });

  return returnFetchedData<{ documents: MemoryDocumentSummary[] }>(response);
}

export async function fetchMemoryDocument(
  name: string,
  projectId?: string,
): Promise<MemoryDocument> {
  const response = await fetchApiOrThrow(
    `${BASE_PATH}/${encodeURIComponent(name)}${scopeQuery(projectId)}`,
    { method: "GET", headers: await apiService.getHeaders() },
  );

  return returnFetchedData<MemoryDocument>(response);
}

export async function createMemoryDocument(
  input: CreateMemoryDocumentInput,
): Promise<MemoryDocument> {
  const response = await fetchApiOrThrow(BASE_PATH, {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: input,
  });

  return returnFetchedData<MemoryDocument>(response);
}

export async function updateMemoryDocument(
  name: string,
  input: UpdateMemoryDocumentInput,
): Promise<MemoryDocument> {
  const response = await fetchApiOrThrow(`${BASE_PATH}/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: await apiService.getHeaders(),
    body: input,
  });

  return returnFetchedData<MemoryDocument>(response);
}

export async function deleteMemoryDocument(name: string, projectId?: string): Promise<void> {
  await fetchApiOrThrow(`${BASE_PATH}/${encodeURIComponent(name)}${scopeQuery(projectId)}`, {
    method: "DELETE",
    headers: await apiService.getHeaders(),
  });
}
