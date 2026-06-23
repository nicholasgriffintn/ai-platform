import {
	ARTIFICIAL_ANALYSIS_FREE_MODEL_ENDPOINTS,
	buildArtificialAnalysisEndpointUrl,
} from "~/lib/artificial-analysis/endpoints";
import type { ArtificialAnalysisEndpoint } from "~/lib/artificial-analysis/endpoints";
import { parseArtificialAnalysisModelsResponse } from "~/lib/artificial-analysis/records";
import type { ArtificialAnalysisModelRecord } from "~/lib/artificial-analysis/types";
import { readRecordObjectField } from "~/utils/recordFields";

async function fetchArtificialAnalysisEndpointModels({
	apiKey,
	endpoint,
	fetchImpl,
	ingestedAt,
}: {
	apiKey: string;
	endpoint: ArtificialAnalysisEndpoint;
	fetchImpl: typeof fetch;
	ingestedAt: string;
}): Promise<ArtificialAnalysisModelRecord[]> {
	const models: ArtificialAnalysisModelRecord[] = [];
	let page = 1;
	let hasMore = true;

	while (hasMore) {
		const url = buildArtificialAnalysisEndpointUrl(endpoint, endpoint.paginated ? page : undefined);
		const response = await fetchImpl(url, {
			headers: {
				accept: "application/json",
				"x-api-key": apiKey,
			},
		});

		if (!response.ok) {
			throw new Error(`Artificial Analysis API request failed: ${response.status}`);
		}

		const payload = await response.json();
		models.push(...parseArtificialAnalysisModelsResponse(payload, ingestedAt, endpoint));
		const pagination = readRecordObjectField(payload, "pagination");
		hasMore = endpoint.paginated && pagination.has_more === true;
		page += 1;
	}

	return models;
}

export async function fetchArtificialAnalysisModels(
	apiKey: string,
	fetchImpl: typeof fetch = fetch,
): Promise<ArtificialAnalysisModelRecord[]> {
	const ingestedAt = new Date().toISOString();
	const models: ArtificialAnalysisModelRecord[] = [];

	for (const endpoint of ARTIFICIAL_ANALYSIS_FREE_MODEL_ENDPOINTS) {
		models.push(
			...(await fetchArtificialAnalysisEndpointModels({
				apiKey,
				endpoint,
				fetchImpl,
				ingestedAt,
			})),
		);
	}

	return models;
}
