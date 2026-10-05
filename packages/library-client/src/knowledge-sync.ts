import {
  createRepositoryKnowledgeSyncSchema,
  knowledgeSearchSchema,
  knowledgeSearchResponseSchema,
  repositoryKnowledgeSyncControlSchema,
  repositoryKnowledgeSyncListSchema,
  repositoryKnowledgeSyncSchema,
  type CreateRepositoryKnowledgeSync,
  type KnowledgeSearch,
  type RepositoryKnowledgeSyncControl,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

export async function listKnowledgeConnections(projectId?: string) {
  const suffix = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  const response = await fetchApiOrThrow("/sources/knowledge" + suffix, {
    headers: await apiService.getHeaders(),
  });

  return repositoryKnowledgeSyncListSchema.parse(await returnFetchedData<unknown>(response)).syncs;
}

export async function createKnowledgeConnection(input: CreateRepositoryKnowledgeSync) {
  const response = await fetchApiOrThrow("/sources/knowledge", {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: createRepositoryKnowledgeSyncSchema.parse(input),
  });

  return repositoryKnowledgeSyncSchema.parse(await returnFetchedData<unknown>(response));
}

export async function controlKnowledgeConnection(
  id: string,
  input: RepositoryKnowledgeSyncControl,
) {
  const response = await fetchApiOrThrow(`/sources/knowledge/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: await apiService.getHeaders(),
    body: repositoryKnowledgeSyncControlSchema.parse(input),
  });

  return repositoryKnowledgeSyncSchema.parse(await returnFetchedData<unknown>(response));
}

export async function deleteKnowledgeConnection(id: string): Promise<void> {
  await fetchApiOrThrow(`/sources/knowledge/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await apiService.getHeaders(),
  });
}

export async function searchConnectedKnowledge(input: KnowledgeSearch) {
  const response = await fetchApiOrThrow("/sources/knowledge/search", {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: knowledgeSearchSchema.parse(input),
  });

  return knowledgeSearchResponseSchema.parse(await returnFetchedData<unknown>(response)).results;
}
