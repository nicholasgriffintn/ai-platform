import type {
  CreateSourceCollectionInput,
  KnowledgeIndexStatus,
  CreateSourceInput,
  Source,
  SourceCollection,
  SourceKind,
  SourceSummary,
  ProjectKnowledgeSearchQuery,
  ProjectKnowledgeSearchResponse,
  KnowledgeSync,
  CreateKnowledgeSync,
  UpdateKnowledgeSync,
} from "@ngriffin_uk/polychat-schemas";

import { fetchApiData as request } from "./fetch-wrapper.js";

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

export async function listKnowledgeSyncs(projectId: string): Promise<KnowledgeSync[]> {
  return (
    await request<{ syncs: KnowledgeSync[] }>(
      `/sources/knowledge-syncs?projectId=${encodeURIComponent(projectId)}`,
    )
  ).syncs;
}

export async function createKnowledgeSync(input: CreateKnowledgeSync): Promise<KnowledgeSync> {
  return request("/sources/knowledge-syncs", { method: "POST", body: input });
}

export async function controlKnowledgeSync(
  id: string,
  input: UpdateKnowledgeSync,
): Promise<KnowledgeSync> {
  return request(`/sources/knowledge-syncs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
}

export async function searchProjectKnowledge(
  input: ProjectKnowledgeSearchQuery,
): Promise<ProjectKnowledgeSearchResponse> {
  const query = new URLSearchParams({ query: input.query });

  if (input.projectId) {
    query.set("projectId", input.projectId);
  }

  if (input.type) {
    query.set("type", input.type);
  }

  if (input.top_k) {
    query.set("top_k", String(input.top_k));
  }

  return request(`/sources/search?${query.toString()}`);
}

export async function createSource(input: CreateSourceInput): Promise<Source> {
  return request("/sources", { method: "POST", body: input });
}

export async function deleteSource(sourceId: string): Promise<void> {
  await request(`/sources/${encodeURIComponent(sourceId)}`, { method: "DELETE" });
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
