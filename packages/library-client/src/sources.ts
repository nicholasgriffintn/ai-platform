import type {
  CreateSourceCollectionInput,
  CreateSourceSyncInput,
  SourceSync,
  KnowledgeSearchInput,
  KnowledgeSearchResponse,
  KnowledgeIndexStatus,
  CreateSourceInput,
  Source,
  SourceCollection,
  SourceKind,
  SourceSummary,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

async function request<T>(path: string, init: { method?: string; body?: object } = {}): Promise<T> {
  const response = await fetchApiOrThrow(path, {
    method: init.method ?? "GET",
    headers: await apiService.getHeaders(),
    body: init.body,
  });

  return returnFetchedData<T>(response);
}

export async function listSources(
  filters: {
    projectId?: string;
    kind?: SourceKind;
  } = {},
): Promise<SourceSummary[]> {
  const query = new URLSearchParams();

  if (filters.projectId) {
    query.set("projectId", filters.projectId);
  }

  if (filters.kind) {
    query.set("kind", filters.kind);
  }

  const suffix = query.size ? `?${query.toString()}` : "";

  return (await request<{ sources: SourceSummary[] }>(`/sources${suffix}`)).sources;
}

export async function getSource(sourceId: string): Promise<Source> {
  return request(`/sources/${encodeURIComponent(sourceId)}`);
}

export async function createSource(input: CreateSourceInput): Promise<Source> {
  return request("/sources", { method: "POST", body: input });
}

export async function deleteSource(sourceId: string): Promise<void> {
  await request(`/sources/${encodeURIComponent(sourceId)}`, { method: "DELETE" });
}

export async function searchKnowledge(
  input: KnowledgeSearchInput,
): Promise<KnowledgeSearchResponse> {
  return request("/sources/search", { method: "POST", body: input });
}

export async function listSourceSyncs(projectId?: string): Promise<SourceSync[]> {
  const suffix = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";

  return (await request<{ syncs: SourceSync[] }>(`/sources/syncs${suffix}`)).syncs;
}

export async function createSourceSync(input: CreateSourceSyncInput): Promise<SourceSync[]> {
  return (await request<{ syncs: SourceSync[] }>("/sources/syncs", { method: "POST", body: input }))
    .syncs;
}

export async function updateSourceSync(input: {
  syncId: string;
  enabled: boolean;
}): Promise<SourceSync[]> {
  return (
    await request<{ syncs: SourceSync[] }>(`/sources/syncs/${encodeURIComponent(input.syncId)}`, {
      method: "PUT",
      body: { enabled: input.enabled },
    })
  ).syncs;
}

export async function deleteSourceSync(syncId: string): Promise<void> {
  await request(`/sources/syncs/${encodeURIComponent(syncId)}`, { method: "DELETE" });
}

export async function listKnowledgeIndexStatus(
  projectId?: string,
): Promise<KnowledgeIndexStatus[]> {
  const suffix = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";

  return (await request<{ sources: KnowledgeIndexStatus[] }>(`/sources/index-status${suffix}`))
    .sources;
}

export async function retryKnowledgeIndex(sourceId: string): Promise<void> {
  await request(`/sources/${encodeURIComponent(sourceId)}/reindex`, { method: "POST" });
}

export async function listSourceCollections(projectId?: string): Promise<SourceCollection[]> {
  const suffix = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";

  return (await request<{ collections: SourceCollection[] }>(`/sources/collections${suffix}`))
    .collections;
}

export async function createSourceCollection(
  input: CreateSourceCollectionInput,
): Promise<SourceCollection> {
  return request("/sources/collections", { method: "POST", body: input });
}

export async function deleteSourceCollection(collectionId: string): Promise<void> {
  await request(`/sources/collections/${encodeURIComponent(collectionId)}`, { method: "DELETE" });
}

export async function listCollectionSources(collectionId: string): Promise<SourceSummary[]> {
  return (
    await request<{ sources: SourceSummary[] }>(
      `/sources/collections/${encodeURIComponent(collectionId)}/sources`,
    )
  ).sources;
}

export async function addCollectionSources(
  collectionId: string,
  sourceIds: string[],
): Promise<void> {
  await request(`/sources/collections/${encodeURIComponent(collectionId)}/sources`, {
    method: "POST",
    body: { sourceIds },
  });
}

export async function listProjectContextSources(projectId: string): Promise<SourceSummary[]> {
  return (
    await request<{ sources: SourceSummary[] }>(
      `/sources/project-context?projectId=${encodeURIComponent(projectId)}`,
    )
  ).sources;
}

export async function listProjectConversationSources(projectId: string): Promise<Source[]> {
  return (
    await request<{ sources: Source[] }>(
      `/sources/project-conversation?projectId=${encodeURIComponent(projectId)}`,
    )
  ).sources;
}

export async function setProjectContextSources(
  projectId: string,
  sourceIds: string[],
): Promise<SourceSummary[]> {
  return (
    await request<{ sources: SourceSummary[] }>(
      `/sources/project-context?projectId=${encodeURIComponent(projectId)}`,
      { method: "PUT", body: { sourceIds } },
    )
  ).sources;
}
