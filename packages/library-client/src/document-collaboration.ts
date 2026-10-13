import {
  documentCommentListSchema,
  documentCommentSchema,
  documentEditProposalSchema,
  outputSchema,
  type CreateDocumentCommentInput,
  type DocumentEditProposal,
  type ProposeDocumentEditInput,
  type ResolveDocumentThreadInput,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

export async function listDocumentComments(outputId: string, after?: string) {
  const query = after ? `?${new URLSearchParams({ after })}` : "";
  const response = await fetchApiOrThrow(
    `/outputs/${encodeURIComponent(outputId)}/comments${query}`,
    {
      method: "GET",
      headers: await apiService.getHeaders(),
    },
  );

  return documentCommentListSchema.parse(await returnFetchedData<unknown>(response));
}

export async function createDocumentComment(outputId: string, input: CreateDocumentCommentInput) {
  const response = await fetchApiOrThrow(`/outputs/${encodeURIComponent(outputId)}/comments`, {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: input,
  });

  return documentCommentSchema.parse(await returnFetchedData<unknown>(response));
}

export async function resolveDocumentThread(
  outputId: string,
  commentId: string,
  input: ResolveDocumentThreadInput,
) {
  const response = await fetchApiOrThrow(
    `/outputs/${encodeURIComponent(outputId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: "PUT",
      headers: await apiService.getHeaders(),
      body: input,
    },
  );

  return documentCommentSchema.parse(await returnFetchedData<unknown>(response));
}

export async function proposeDocumentEdit(outputId: string, input: ProposeDocumentEditInput) {
  const response = await fetchApiOrThrow(`/outputs/${encodeURIComponent(outputId)}/edits/propose`, {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: input,
  });

  return documentEditProposalSchema.parse(await returnFetchedData<unknown>(response));
}

export async function applyDocumentEdit(outputId: string, proposal: DocumentEditProposal) {
  const response = await fetchApiOrThrow(`/outputs/${encodeURIComponent(outputId)}/edits/apply`, {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: proposal,
  });

  return outputSchema.parse(await returnFetchedData<unknown>(response));
}
