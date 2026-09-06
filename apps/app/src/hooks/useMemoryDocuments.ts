import type {
  CreateMemoryDocumentInput,
  MemoryDocument,
  MemoryDocumentSummary,
  UpdateMemoryDocumentInput,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createMemoryDocument,
  deleteMemoryDocument,
  fetchMemoryDocument,
  listMemoryDocuments,
  updateMemoryDocument,
} from "~/lib/api/memory-documents";

export const MEMORY_DOCUMENT_QUERY_KEY = "memory-documents";

export function useMemoryDocuments(projectId?: string) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [MEMORY_DOCUMENT_QUERY_KEY, projectId] });

  const documentsQuery = useQuery({
    queryKey: [MEMORY_DOCUMENT_QUERY_KEY, projectId],
    queryFn: async (): Promise<MemoryDocumentSummary[]> =>
      (await listMemoryDocuments(projectId)).documents,
    staleTime: 1000 * 30,
  });

  const create = useMutation<MemoryDocument, Error, CreateMemoryDocumentInput>({
    mutationFn: (input) => createMemoryDocument(input),
    onSuccess: invalidate,
  });

  const update = useMutation<
    MemoryDocument,
    Error,
    { name: string; input: UpdateMemoryDocumentInput }
  >({
    mutationFn: ({ name, input }) => updateMemoryDocument(name, input),
    onSuccess: invalidate,
  });

  const remove = useMutation<void, Error, string>({
    mutationFn: (name) => deleteMemoryDocument(name, projectId),
    onSuccess: invalidate,
  });

  const documents: MemoryDocumentSummary[] = documentsQuery.data ?? [];

  return {
    documents,
    isLoading: documentsQuery.isLoading,
    error: documentsQuery.error,
    create,
    update,
    remove,
  };
}

export function useMemoryDocument(name: string | undefined, projectId?: string) {
  return useQuery<MemoryDocument>({
    queryKey: [MEMORY_DOCUMENT_QUERY_KEY, projectId, name],
    queryFn: () => fetchMemoryDocument(name ?? "", projectId),
    enabled: Boolean(name),
  });
}
