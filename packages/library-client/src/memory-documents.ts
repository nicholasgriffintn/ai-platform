import type {
  CreateMemoryDocumentInput,
  ListPage,
  MemoryDocument,
  MemoryDocumentRevision,
  MemoryDocumentSummary,
  UpdateMemoryDocumentInput,
} from "@ngriffin_uk/polychat-schemas";

import { requestJson, resource, withQuery } from "./resource.js";

const documents = resource<MemoryDocument, CreateMemoryDocumentInput, UpdateMemoryDocumentInput>(
  "/memory/documents",
);

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

export async function listMemoryDocumentRevisions(
  name: string,
  projectId?: string,
): Promise<MemoryDocumentRevision[]> {
  const page = await requestJson<ListPage<MemoryDocumentRevision>>(
    withQuery(`${documents.path}/${encodeURIComponent(name)}/revisions`, {
      project_id: projectId,
    }),
    "GET",
  );

  return page.data;
}
