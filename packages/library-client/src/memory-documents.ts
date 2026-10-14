import type {
  CreateMemoryDocumentInput,
  ListPage,
  MemoryDocument,
  MemoryDocumentSummary,
  UpdateMemoryDocumentInput,
  ConversationBriefResponse,
} from "@ngriffin_uk/polychat-schemas";

import { requestJson, resource, singleton, withQuery } from "./resource.js";

const documents = resource<MemoryDocument, CreateMemoryDocumentInput, UpdateMemoryDocumentInput>(
  "/memory/documents",
);

function briefOf(conversationId: string) {
  return singleton<ConversationBriefResponse>(
    `/conversations/${encodeURIComponent(conversationId)}/brief`,
  );
}

export function fetchConversationBrief(conversationId: string): Promise<ConversationBriefResponse> {
  return briefOf(conversationId).get();
}

export function ensureConversationBrief(
  conversationId: string,
): Promise<ConversationBriefResponse> {
  return briefOf(conversationId).create();
}

export function updateConversationBrief(
  conversationId: string,
  input: UpdateMemoryDocumentInput,
): Promise<MemoryDocument> {
  return requestJson<MemoryDocument>(briefOf(conversationId).path, "PATCH", input);
}

export async function listMemoryDocuments(projectId?: string): Promise<MemoryDocumentSummary[]> {
  const page = await requestJson<ListPage<MemoryDocumentSummary>>(
    withQuery(documents.path, { project_id: projectId }),
    "GET",
  );

  return page.data;
}

export function fetchMemoryDocument(name: string, projectId?: string): Promise<MemoryDocument> {
  return documents.get(name, { project_id: projectId });
}

export function createMemoryDocument(input: CreateMemoryDocumentInput): Promise<MemoryDocument> {
  return documents.create(input);
}

export function updateMemoryDocument(
  name: string,
  input: UpdateMemoryDocumentInput,
): Promise<MemoryDocument> {
  return documents.update(name, input);
}

export async function deleteMemoryDocument(name: string, projectId?: string): Promise<void> {
  await requestJson<unknown>(
    withQuery(`${documents.path}/${encodeURIComponent(name)}`, { project_id: projectId }),
    "DELETE",
  );
}
