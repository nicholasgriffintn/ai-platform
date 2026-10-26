import {
  documentCommentListSchema,
  documentCommentSchema,
  documentEditProposalSchema,
  outputSchema,
  type CreateDocumentCommentInput,
  type DocumentCommentSubject,
  type DocumentEditProposal,
  type ProposeDocumentEditInput,
  type ResolveDocumentThreadInput,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

function commentsPath(subject: DocumentCommentSubject, suffix = ""): string {
  const collection = subject.type === "output" ? "outputs" : "sources";

  return `/${collection}/${encodeURIComponent(subject.id)}/comments${suffix}`;
}

export async function listDocumentComments(subject: DocumentCommentSubject, after?: string) {
  const query = after ? `?${new URLSearchParams({ after })}` : "";
  const response = await fetchApiOrThrow(commentsPath(subject, query), {
    method: "GET",
    headers: await apiService.getHeaders(),
  });

  return documentCommentListSchema.parse(await returnFetchedData<unknown>(response));
}

export async function createDocumentComment(
  subject: DocumentCommentSubject,
  input: CreateDocumentCommentInput,
) {
  const response = await fetchApiOrThrow(commentsPath(subject), {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: input,
  });

  return documentCommentSchema.parse(await returnFetchedData<unknown>(response));
}

export async function resolveDocumentThread(
  subject: DocumentCommentSubject,
  commentId: string,
  input: ResolveDocumentThreadInput,
) {
  const response = await fetchApiOrThrow(
    commentsPath(subject, `/${encodeURIComponent(commentId)}`),
    {
      method: "PATCH",
      headers: await apiService.getHeaders(),
      body: input,
    },
  );

  return documentCommentSchema.parse(await returnFetchedData<unknown>(response));
}

export async function proposeDocumentEdit(outputId: string, input: ProposeDocumentEditInput) {
  const response = await fetchApiOrThrow(`/outputs/${encodeURIComponent(outputId)}/edits`, {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: input,
  });

  return documentEditProposalSchema.parse(await returnFetchedData<unknown>(response));
}

export async function applyDocumentEdit(outputId: string, proposal: DocumentEditProposal) {
  const response = await fetchApiOrThrow(`/outputs/${encodeURIComponent(outputId)}`, {
    method: "PATCH",
    headers: await apiService.getHeaders(),
    body: { edit: proposal },
  });

  return outputSchema.parse(await returnFetchedData<unknown>(response));
}
