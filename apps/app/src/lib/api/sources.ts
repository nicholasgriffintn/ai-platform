import type {
	CreateSourceCollectionInput,
	CreateSourceInput,
	Source,
	SourceCollection,
	SourceKind,
	SourceSummary,
} from "@assistant/schemas";

import { apiService } from "./api-service";
import { fetchApi, returnFetchedData } from "./fetch-wrapper";

async function request<T>(path: string, init: { method?: string; body?: object } = {}): Promise<T> {
	const response = await fetchApi(path, {
		method: init.method ?? "GET",
		headers: await apiService.getHeaders(),
		body: init.body,
	});
	if (!response.ok) throw new Error(`Source request failed: ${response.statusText}`);
	return returnFetchedData<T>(response);
}

export async function listSources(
	filters: {
		projectId?: string;
		kind?: SourceKind;
	} = {},
): Promise<SourceSummary[]> {
	const query = new URLSearchParams();
	if (filters.projectId) query.set("projectId", filters.projectId);
	if (filters.kind) query.set("kind", filters.kind);
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
