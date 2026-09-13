import {
  createMemoryDocument,
  deleteMemoryDocument,
  fetchMemoryDocument,
  listMemoryDocuments,
  updateMemoryDocument,
  updateConversationBrief,
  ensureConversationBrief,
  fetchConversationBrief,
  useChatStore,
  ApiError,
} from "@ngriffin_uk/polychat-library-client";
import type {
  CreateMemoryDocumentInput,
  MemoryDocument,
  MemoryDocumentSummary,
  UpdateMemoryDocumentInput,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const MEMORY_DOCUMENT_QUERY_KEY = "memory-documents";
export const conversationBriefQueryKey = (conversationId: string) =>
  ["conversation-brief", conversationId] as const;

export function useConversationBrief(conversationId: string | undefined) {
  const queryClient = useQueryClient();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isAwaitingRemoteConversation = useChatStore((state) =>
    Boolean(conversationId && state.locallyCreatedConversationIds[conversationId]),
  );
  const enabled = Boolean(conversationId) && isAuthenticated && !isAwaitingRemoteConversation;
  const query = useQuery({
    queryKey: conversationBriefQueryKey(conversationId ?? ""),
    queryFn: async () => {
      try {
        return await fetchConversationBrief(conversationId ?? "");
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return { conversationId: conversationId ?? "", document: null };
        }

        throw error;
      }
    },
    enabled,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) {
        return false;
      }

      return failureCount < 2;
    },
  });
  const ensure = useMutation({
    mutationFn: () => ensureConversationBrief(conversationId ?? ""),
    onSuccess: (response) => {
      queryClient.setQueryData(conversationBriefQueryKey(response.conversationId), response);
      void queryClient.invalidateQueries({ queryKey: [MEMORY_DOCUMENT_QUERY_KEY] });
    },
  });
  const update = useMutation<MemoryDocument, Error, UpdateMemoryDocumentInput>({
    mutationFn: (input) => updateConversationBrief(conversationId ?? "", input),
    onSuccess: (document) => {
      queryClient.setQueryData(conversationBriefQueryKey(conversationId ?? ""), {
        conversationId,
        document,
      });
    },
  });

  return { ...query, ensure, update, isAwaitingRemoteConversation };
}

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
