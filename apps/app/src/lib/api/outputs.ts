import type {
	Output,
	OutputShare,
	OutputSummary,
	SharedOutput,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service";
import { returnFetchedData } from "@ngriffin_uk/polychat-library-client";
import { fetchApiOrThrow } from "./fetch-wrapper";

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
	const response = await fetchApiOrThrow(`/outputs${suffix}`, {
		method: "GET",
		headers: await getHeaders(),
	});
	return (await returnFetchedData<{ outputs: OutputSummary[] }>(response)).outputs;
}

export async function getOutput(outputId: string): Promise<Output> {
	const response = await fetchApiOrThrow(`/outputs/${encodeURIComponent(outputId)}`, {
		method: "GET",
		headers: await getHeaders(),
	});
	return returnFetchedData<Output>(response);
}

export async function createOutputShare(
	outputId: string,
	expiresAt?: string | null,
): Promise<{ share: OutputShare; token: string }> {
	const response = await fetchApiOrThrow(`/outputs/${encodeURIComponent(outputId)}/shares`, {
		method: "POST",
		headers: await getHeaders(),
		body: { expiresAt },
	});
	return returnFetchedData<{ share: OutputShare; token: string }>(response);
}

export async function listOutputShares(outputId: string): Promise<OutputShare[]> {
	const response = await fetchApiOrThrow(`/outputs/${encodeURIComponent(outputId)}/shares`, {
		method: "GET",
		headers: await getHeaders(),
	});
	return (await returnFetchedData<{ shares: OutputShare[] }>(response)).shares;
}

export async function revokeOutputShare(outputId: string, shareId: string): Promise<void> {
	await fetchApiOrThrow(
		`/outputs/${encodeURIComponent(outputId)}/shares/${encodeURIComponent(shareId)}`,
		{
			method: "DELETE",
			headers: await getHeaders(),
		},
	);
}

export async function getSharedOutput(token: string): Promise<SharedOutput> {
	const response = await fetchApiOrThrow(`/outputs/shared/${encodeURIComponent(token)}`, {
		method: "GET",
	});
	return returnFetchedData<SharedOutput>(response);
}
