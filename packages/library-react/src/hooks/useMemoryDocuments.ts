import {
  createMemoryDocument,
  deleteMemoryDocument,
  fetchMemoryDocument,
  importMemory,
  listMemoryDocumentRevisions,
  listMemoryDocuments,
  updateMemoryDocument,
} from "@ngriffin_uk/polychat-library-client";
import type {
  CreateMemoryDocumentInput,
  CreateMemoryImportInput,
  MemoryDocument,
  MemoryDocumentSummary,
  MemoryImportResponse,
  UpdateMemoryDocumentInput,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const MEMORY_DOCUMENT_QUERY_KEY = "memory-documents";

export function useMemoryDocuments(projectId?: string) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [MEMORY_DOCUMENT_QUERY_KEY, projectId] });

  const documentsQuery = useQuery({
    queryKey: [MEMORY_DOCUMENT_QUERY_KEY, projectId],
    queryFn: async (): Promise<MemoryDocumentSummary[]> => await listMemoryDocuments(projectId),
    staleTime: 1000 * 30,
  });

  const create = useMutation<MemoryDocument, Error, CreateMemoryDocumentInput>({
    mutationFn: (input) => createMemoryDocument(input),
    onSuccess: invalidate,
  });

  const update = useUpdateMemoryDocument(projectId);

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

export function useUpdateMemoryDocument(projectId?: string) {
  const queryClient = useQueryClient();

  return useMutation<MemoryDocument, Error, { name: string; input: UpdateMemoryDocumentInput }>({
    mutationFn: ({ name, input }) => updateMemoryDocument(name, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [MEMORY_DOCUMENT_QUERY_KEY, projectId] }),
  });
}

export function useMemoryDocument(name: string | undefined, projectId?: string) {
  return useQuery<MemoryDocument>({
    queryKey: [MEMORY_DOCUMENT_QUERY_KEY, projectId, name],
    queryFn: () => fetchMemoryDocument(name ?? "", projectId),
    enabled: Boolean(name),
  });
}

export function useMemoryDocumentRevisions(name: string | undefined, projectId?: string) {
  return useQuery({
    queryKey: [MEMORY_DOCUMENT_QUERY_KEY, projectId, name, "revisions"],
    queryFn: () => listMemoryDocumentRevisions(name ?? "", projectId),
    enabled: Boolean(name),
  });
}

export function useImportMemory() {
  return useMutation<MemoryImportResponse, Error, CreateMemoryImportInput>({
    mutationFn: (input) => importMemory(input),
  });
}
