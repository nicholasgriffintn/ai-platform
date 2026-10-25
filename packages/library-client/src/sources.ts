import type {
  CreateSourceCollectionInput,
  CreateSourceInput,
  GeneratePodcastRequest,
  OutputSummary,
  Source,
  SourceCollection,
  SourceGenerationType,
  SourceKind,
  SourceSummary,
  UpdateSourceInput,
  ProjectKnowledgeSearchQuery,
  ProjectKnowledgeSearchResponse,
  KnowledgeSync,
  ListPage,
  CreateKnowledgeSync,
  UpdateKnowledgeSync,
} from "@ngriffin_uk/polychat-schemas";

import { fetchApiData as request } from "./fetch-wrapper.js";
import { apiMediaUrl } from "./media-url.js";

export interface SourceListFilters {
  projectId?: string;
  kind?: SourceKind;
  generation?: SourceGenerationType;
}

function sourcePath(sourceId: string, suffix = ""): string {
  return `/sources/${encodeURIComponent(sourceId)}${suffix}`;
}

export function getSourceContentUrl(sourceId: string): string {
  return apiMediaUrl(sourcePath(sourceId, "/content"));
}

export function getSourceCoverUrl(sourceId: string): string {
  return apiMediaUrl(sourcePath(sourceId, "/cover"));
}

export async function listSources(filters: SourceListFilters = {}): Promise<SourceSummary[]> {
  const query = new URLSearchParams();

  if (filters.projectId) {
    query.set("project_id", filters.projectId);
  }

  if (filters.kind) {
    query.set("kind", filters.kind);
  }

  if (filters.generation) {
    query.set("generation", filters.generation);
  }

  const suffix = query.size ? `?${query.toString()}` : "";

  return (await request<ListPage<SourceSummary>>(`/sources${suffix}`)).data;
}

export async function getSource(sourceId: string): Promise<Source> {
  return request(sourcePath(sourceId));
}

export async function transcribeSource(sourceId: string): Promise<Source> {
  return request(sourcePath(sourceId, "/transcribe"), { method: "POST", body: {} });
}

export async function listenToSource(sourceId: string): Promise<Source> {
  return request(sourcePath(sourceId, "/listen"), { method: "POST", body: {} });
}

export function getSourceListenPassageUrl(sourceId: string, passage: number): string {
  return apiMediaUrl(sourcePath(sourceId, `/listen/${passage}`));
}

export async function writeSourceNotes(
  sourceId: string,
  speakers?: Record<string, string>,
): Promise<Source> {
  return request(sourcePath(sourceId, "/notes"), {
    method: "POST",
    body: speakers ? { speakers } : {},
    timeoutMs: null,
  });
}

export async function createSourceCover(sourceId: string, prompt?: string): Promise<Source> {
  return request(sourcePath(sourceId, "/cover"), {
    method: "POST",
    body: prompt ? { prompt } : {},
    timeoutMs: null,
  });
}

export async function generatePodcast(input: GeneratePodcastRequest): Promise<Source> {
  return request("/sources/podcasts", { method: "POST", body: input });
}

export async function enablePodcastFeed(collectionId: string): Promise<{ url: string }> {
  return request(`/sources/collections/${encodeURIComponent(collectionId)}/feed`, {
    method: "POST",
    body: {},
  });
}

export async function disablePodcastFeed(collectionId: string): Promise<void> {
  await request(`/sources/collections/${encodeURIComponent(collectionId)}/feed`, {
    method: "DELETE",
  });
}

export async function listKnowledgeSyncs(
  target: { projectId: string } | { notebookId: string } | { library: true },
): Promise<KnowledgeSync[]> {
  const query =
    "projectId" in target
      ? `?project_id=${encodeURIComponent(target.projectId)}`
      : "notebookId" in target
        ? `?notebook_id=${encodeURIComponent(target.notebookId)}`
        : "";

  return (await request<ListPage<KnowledgeSync>>(`/sources/knowledge_syncs${query}`)).data;
}

export async function createKnowledgeSync(input: CreateKnowledgeSync): Promise<KnowledgeSync> {
  return request("/sources/knowledge_syncs", { method: "POST", body: input });
}

export async function controlKnowledgeSync(
  id: string,
  input: UpdateKnowledgeSync,
): Promise<KnowledgeSync> {
  return request(`/sources/knowledge_syncs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
}

export async function deleteKnowledgeSync(id: string): Promise<void> {
  await request(`/sources/knowledge_syncs/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function searchProjectKnowledge(
  input: ProjectKnowledgeSearchQuery,
): Promise<ProjectKnowledgeSearchResponse> {
  const query = new URLSearchParams({ query: input.query });

  if (input.projectId) {
    query.set("project_id", input.projectId);
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

export async function updateSource(sourceId: string, input: UpdateSourceInput): Promise<Source> {
  return request(sourcePath(sourceId), { method: "PATCH", body: input });
}

export async function deleteSource(sourceId: string): Promise<void> {
  await request(`/sources/${encodeURIComponent(sourceId)}`, { method: "DELETE" });
}

export async function listSourceCollections(projectId?: string): Promise<SourceCollection[]> {
  const suffix = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";

  return (await request<ListPage<SourceCollection>>(`/sources/collections${suffix}`)).data;
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
    await request<ListPage<SourceSummary>>(
      `/sources/collections/${encodeURIComponent(collectionId)}/sources`,
    )
  ).data;
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

export async function listCollectionOutputs(collectionId: string): Promise<OutputSummary[]> {
  return (
    await request<ListPage<OutputSummary>>(
      `/sources/collections/${encodeURIComponent(collectionId)}/outputs`,
    )
  ).data;
}

export async function addCollectionOutputs(
  collectionId: string,
  outputIds: string[],
): Promise<void> {
  await request(`/sources/collections/${encodeURIComponent(collectionId)}/outputs`, {
    method: "POST",
    body: { outputIds },
  });
}

export async function listProjectContextSources(projectId: string): Promise<SourceSummary[]> {
  return (
    await request<ListPage<SourceSummary>>(
      `/sources?project_id=${encodeURIComponent(projectId)}&scope=context`,
    )
  ).data;
}

export async function listProjectConversationSources(projectId: string): Promise<Source[]> {
  return (
    await request<ListPage<Source>>(
      `/sources?project_id=${encodeURIComponent(projectId)}&scope=conversation`,
    )
  ).data;
}

export async function setProjectContextSources(
  projectId: string,
  sourceIds: string[],
): Promise<SourceSummary[]> {
  return (
    await request<ListPage<SourceSummary>>("/sources/project_context", {
      method: "PATCH",
      body: { project_id: projectId, sourceIds },
    })
  ).data;
}
