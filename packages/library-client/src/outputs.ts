import type {
  CouncilReview,
  CouncilReviewListResponse,
  DocumentMetadata,
  ListPage,
  Output,
  OutputHistoryResponse,
  OutputShare,
  OutputSummary,
  SharedOutput,
} from "@ngriffin_uk/polychat-schemas";
import { readAttachmentFilename } from "@ngriffin_uk/polychat-utility-core";

import { apiService } from "./api-service.js";
import { readBoundedTextResponse, type BoundedTextResponse } from "./bounded-response.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";
import { resource } from "./resource.js";

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
  const page = await resource<OutputSummary>("/outputs").list({
    project_id: filters.projectId,
    capability_id: filters.capabilityId,
    kind: filters.kind,
  });

  return page.data;
}

export async function getOutput(outputId: string): Promise<Output> {
  const response = await fetchApiOrThrow(`/outputs/${encodeURIComponent(outputId)}`, {
    method: "GET",
    headers: await getHeaders(),
  });

  return returnFetchedData<Output>(response);
}

export async function getOutputHistory(outputId: string): Promise<OutputHistoryResponse> {
  const response = await fetchApiOrThrow(`/outputs/${encodeURIComponent(outputId)}/revisions`, {
    method: "GET",
    headers: await getHeaders(),
  });

  return returnFetchedData<OutputHistoryResponse>(response);
}

export async function listOutputReviews(outputId: string): Promise<CouncilReview[]> {
  const response = await fetchApiOrThrow(`/outputs/${encodeURIComponent(outputId)}/reviews`, {
    method: "GET",
    headers: await getHeaders(),
  });

  return (await returnFetchedData<CouncilReviewListResponse>(response)).data;
}

export async function requestOutputReview(outputId: string): Promise<CouncilReview> {
  const response = await fetchApiOrThrow(`/outputs/${encodeURIComponent(outputId)}/reviews`, {
    method: "POST",
    headers: await getHeaders(),
  });

  return returnFetchedData<CouncilReview>(response);
}

export async function restoreOutputRevision(
  outputId: string,
  revision: number,
  expectedRevision: number,
): Promise<Output> {
  const response = await fetchApiOrThrow(
    `/outputs/${encodeURIComponent(outputId)}/revisions/${revision}/restore`,
    {
      method: "POST",
      headers: await getHeaders(),
      body: { expectedRevision },
    },
  );

  return returnFetchedData<Output>(response);
}

export async function updateOutput(
  outputId: string,
  updates: { content?: Record<string, unknown>; title?: string; expectedRevision: number },
): Promise<Output> {
  const response = await fetchApiOrThrow(`/outputs/${encodeURIComponent(outputId)}`, {
    method: "PATCH",
    headers: await getHeaders(),
    body: updates,
  });

  return returnFetchedData<Output>(response);
}

export async function deleteOutput(outputId: string): Promise<void> {
  await resource<Output>("/outputs").delete(outputId);
}

export async function formatOutputDocument(
  outputId: string,
  prompt?: string,
): Promise<{ body: string; sourceRevision: number }> {
  const response = await fetchApiOrThrow(`/outputs/${encodeURIComponent(outputId)}/format`, {
    method: "POST",
    headers: await getHeaders(),
    body: prompt ? { prompt } : {},
  });

  return returnFetchedData<{ body: string; sourceRevision: number }>(response);
}

export async function describeOutputDocument(
  outputId: string,
  expectedRevision: number,
): Promise<{ metadata: DocumentMetadata }> {
  const response = await fetchApiOrThrow(`/outputs/${encodeURIComponent(outputId)}/describe`, {
    method: "POST",
    headers: await getHeaders(),
    body: { expectedRevision },
  });

  return returnFetchedData<{ metadata: DocumentMetadata }>(response);
}

export async function exportOutputContent(
  outputId: string,
): Promise<{ blob: Blob; filename: string | null }> {
  const response = await fetchApiOrThrow(`/outputs/${encodeURIComponent(outputId)}/content`, {
    method: "GET",
    headers: await getHeaders(),
  });

  return {
    blob: await response.blob(),
    filename: readAttachmentFilename(response.headers.get("content-disposition")),
  };
}

export async function getOutputArtifactContent(
  outputId: string,
  maxBytes = 1_000_000,
): Promise<BoundedTextResponse> {
  const response = await fetchApiOrThrow(`/outputs/${encodeURIComponent(outputId)}/content`, {
    method: "GET",
    headers: await getHeaders(),
  });

  return readBoundedTextResponse(response, maxBytes);
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

  return (await returnFetchedData<ListPage<OutputShare>>(response)).data;
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
