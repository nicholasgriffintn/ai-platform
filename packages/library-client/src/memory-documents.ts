import type {
  CreateMemoryDocumentInput,
  MemoryDocument,
  MemoryDocumentSummary,
  UpdateMemoryDocumentInput,
  ConversationBriefResponse,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

const BASE_PATH = "/memory/documents";

export async function fetchConversationBrief(
  conversationId: string,
): Promise<ConversationBriefResponse> {
  const response = await fetchApiOrThrow(
    `${BASE_PATH}/conversations/${encodeURIComponent(conversationId)}/brief`,
    { method: "GET", headers: await apiService.getHeaders() },
  );

  return returnFetchedData<ConversationBriefResponse>(response);
}

export async function ensureConversationBrief(
  conversationId: string,
): Promise<ConversationBriefResponse> {
  const response = await fetchApiOrThrow(
    `${BASE_PATH}/conversations/${encodeURIComponent(conversationId)}/brief`,
    { method: "POST", headers: await apiService.getHeaders() },
  );

  return returnFetchedData<ConversationBriefResponse>(response);
}

export async function updateConversationBrief(
  conversationId: string,
  input: UpdateMemoryDocumentInput,
): Promise<MemoryDocument> {
  const response = await fetchApiOrThrow(
    `${BASE_PATH}/conversations/${encodeURIComponent(conversationId)}/brief`,
    {
      method: "PUT",
      headers: await apiService.getHeaders(),
      body: input,
    },
  );

  return returnFetchedData<MemoryDocument>(response);
}

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
