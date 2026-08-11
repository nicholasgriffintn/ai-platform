import type { Output, OutputShare, OutputSummary } from "@assistant/schemas";

import { apiService } from "./api-service";
import { fetchApi, returnFetchedData } from "./fetch-wrapper";

async function getHeaders(): Promise<Record<string, string>> {
	return apiService.getHeaders();
}

export async function listOutputs(
	filters: {
		projectId?: string;
		capabilityId?: string;
		kind?: string;
	} = {},
): Promise<OutputSummary[]> {
	const query = new URLSearchParams();
	if (filters.projectId) query.set("projectId", filters.projectId);
	if (filters.capabilityId) query.set("capabilityId", filters.capabilityId);
	if (filters.kind) query.set("kind", filters.kind);
	const suffix = query.size ? `?${query.toString()}` : "";
	const response = await fetchApi(`/outputs${suffix}`, {
		method: "GET",
		headers: await getHeaders(),
	});
	if (!response.ok) throw new Error(`Failed to fetch outputs: ${response.statusText}`);
	return (await returnFetchedData<{ outputs: OutputSummary[] }>(response)).outputs;
}

export async function getOutput(outputId: string): Promise<Output> {
	const response = await fetchApi(`/outputs/${encodeURIComponent(outputId)}`, {
		method: "GET",
		headers: await getHeaders(),
	});
	if (!response.ok) throw new Error(`Failed to fetch output: ${response.statusText}`);
	return returnFetchedData<Output>(response);
}

export async function createOutputShare(
	outputId: string,
	expiresAt?: string | null,
): Promise<{ share: OutputShare; token: string }> {
	const response = await fetchApi(`/outputs/${encodeURIComponent(outputId)}/shares`, {
		method: "POST",
		headers: await getHeaders(),
		body: { expiresAt },
	});
	if (!response.ok) throw new Error(`Failed to share output: ${response.statusText}`);
	return returnFetchedData<{ share: OutputShare; token: string }>(response);
}

export async function listOutputShares(outputId: string): Promise<OutputShare[]> {
	const response = await fetchApi(`/outputs/${encodeURIComponent(outputId)}/shares`, {
		method: "GET",
		headers: await getHeaders(),
	});
	if (!response.ok) throw new Error(`Failed to fetch output shares: ${response.statusText}`);
	return (await returnFetchedData<{ shares: OutputShare[] }>(response)).shares;
}

export async function revokeOutputShare(outputId: string, shareId: string): Promise<void> {
	const response = await fetchApi(
		`/outputs/${encodeURIComponent(outputId)}/shares/${encodeURIComponent(shareId)}`,
		{
			method: "DELETE",
			headers: await getHeaders(),
		},
	);
	if (!response.ok) throw new Error(`Failed to revoke output share: ${response.statusText}`);
}

export async function getSharedOutput(token: string): Promise<Output> {
	const response = await fetchApi(`/outputs/shared/${encodeURIComponent(token)}`, {
		method: "GET",
	});
	if (!response.ok) throw new Error(`Failed to fetch shared output: ${response.statusText}`);
	return returnFetchedData<Output>(response);
}
