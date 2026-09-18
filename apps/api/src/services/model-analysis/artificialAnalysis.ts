import { readRecordObjectField } from "@ngriffin_uk/polychat-utility-server/record-fields";

import {
  ARTIFICIAL_ANALYSIS_FREE_MODEL_ENDPOINTS,
  buildArtificialAnalysisEndpointUrl,
} from "~/services/model-analysis/artificial-analysis/endpoints";
import type { ArtificialAnalysisEndpoint } from "~/services/model-analysis/artificial-analysis/endpoints";
import { parseArtificialAnalysisModelsResponse } from "~/services/model-analysis/artificial-analysis/records";
import type { ArtificialAnalysisModelRecord } from "~/services/model-analysis/artificial-analysis/types";

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
