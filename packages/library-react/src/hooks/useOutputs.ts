import {
  addCollectionOutputs,
  createOutputShare,
  deleteOutput,
  describeOutputDocument,
  exportOutputContent,
  formatOutputDocument,
  getOutput,
  getOutputHistory,
  listCollectionOutputs,
  listOutputReviews,
  listOutputs,
  listOutputShares,
  revokeOutputShare,
  requestOutputReview,
  restoreOutputRevision,
  updateOutput,
} from "@ngriffin_uk/polychat-library-client";
import { buildDocumentContent, type DocumentMetadata } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const OUTPUT_QUERY_KEYS = {
  all: ["outputs"] as const,
  listsByProject: (projectId?: string) => ["outputs", "list", projectId] as const,
  list: (projectId?: string, capabilityId?: string) =>
    ["outputs", "list", projectId, capabilityId] as const,
  detail: (outputId: string | null) => ["outputs", "detail", outputId] as const,
  collection: (collectionId: string) => ["outputs", "collection", collectionId] as const,
  history: (outputId: string | null) => ["outputs", "history", outputId] as const,
  shares: (outputId: string | null) => ["outputs", "shares", outputId] as const,
  reviews: (outputId: string | null) => ["outputs", "reviews", outputId] as const,
};

export function useOutputs(
  projectId?: string,
  capabilityId?: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: OUTPUT_QUERY_KEYS.list(projectId, capabilityId),
    queryFn: () => listOutputs({ projectId, capabilityId }),
    enabled: options?.enabled ?? true,
  });
}

export function useCollectionOutputs(collectionId: string | undefined) {
  return useQuery({
    queryKey: OUTPUT_QUERY_KEYS.collection(collectionId ?? ""),
    queryFn: () => listCollectionOutputs(collectionId ?? ""),
    enabled: Boolean(collectionId),
  });
}

export function useAddOutputToCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collectionId, outputId }: { collectionId: string; outputId: string }) =>
      addCollectionOutputs(collectionId, [outputId]),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.all }),
        queryClient.invalidateQueries({ queryKey: ["sources", "collections"] }),
      ]),
  });
}

export function useOutput(outputId: string | null) {
  return useQuery({
    queryKey: OUTPUT_QUERY_KEYS.detail(outputId),
    queryFn: () => (outputId ? getOutput(outputId) : Promise.reject(new Error("No output ID"))),
    enabled: Boolean(outputId),
  });
}

export function useOutputHistory(outputId: string | null) {
  return useQuery({
    queryKey: OUTPUT_QUERY_KEYS.history(outputId),
    queryFn: () =>
      outputId ? getOutputHistory(outputId) : Promise.reject(new Error("No output ID")),
    enabled: Boolean(outputId),
  });
}

export function useOutputReviews(outputId: string | null) {
  return useQuery({
    queryKey: OUTPUT_QUERY_KEYS.reviews(outputId),
    queryFn: () =>
      outputId ? listOutputReviews(outputId) : Promise.reject(new Error("No output ID")),
    enabled: Boolean(outputId),
  });
}

export function useRequestOutputReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (outputId: string) => requestOutputReview(outputId),
    onSuccess: (review) =>
      queryClient.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.reviews(review.outputId) }),
  });
}

export function useRestoreOutputRevision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      outputId,
      revision,
      expectedRevision,
    }: {
      outputId: string;
      revision: number;
      expectedRevision: number;
    }) => restoreOutputRevision(outputId, revision, expectedRevision),
    onSettled: (_output, _error, variables) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.detail(variables.outputId) }),
        queryClient.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.history(variables.outputId) }),
        queryClient.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.all }),
      ]),
  });
}

export function useOutputMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.all });

  return {
    rename: useMutation({
      mutationFn: ({
        outputId,
        title,
        expectedRevision,
      }: {
        outputId: string;
        title: string;
        expectedRevision: number;
      }) => updateOutput(outputId, { title, expectedRevision }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: deleteOutput,
      onSuccess: invalidate,
    }),
  };
}

export function useSaveDocumentRevision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      outputId,
      body,
      expectedRevision,
      metadata,
    }: {
      outputId: string;
      body: string;
      expectedRevision: number;
      metadata?: DocumentMetadata;
    }) =>
      updateOutput(outputId, {
        content: buildDocumentContent(body, metadata),
        expectedRevision,
      }),
    onSettled: (_output, _error, variables) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.detail(variables.outputId) }),
        queryClient.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.history(variables.outputId) }),
        queryClient.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.all }),
      ]),
  });
}

export function useFormatDocument() {
  return useMutation({
    mutationFn: ({ outputId, prompt }: { outputId: string; prompt?: string }) =>
      formatOutputDocument(outputId, prompt),
  });
}

export function useDescribeDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ outputId, expectedRevision }: { outputId: string; expectedRevision: number }) =>
      describeOutputDocument(outputId, expectedRevision),
    onSettled: (_result, _error, { outputId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.detail(outputId) }),
        queryClient.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.history(outputId) }),
      ]),
  });
}

export function useExportOutput() {
  return useMutation({
    mutationFn: ({ outputId }: { outputId: string }) => exportOutputContent(outputId),
  });
}

export function useOutputShares(outputId: string | null) {
  return useQuery({
    queryKey: OUTPUT_QUERY_KEYS.shares(outputId),
    queryFn: () =>
      outputId ? listOutputShares(outputId) : Promise.reject(new Error("No output ID")),
    enabled: Boolean(outputId),
  });
}

export function useCreateOutputShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ outputId, expiresAt }: { outputId: string; expiresAt?: string | null }) =>
      createOutputShare(outputId, expiresAt),
    onSuccess: (_share, variables) =>
      queryClient.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.shares(variables.outputId) }),
  });
}

export function useRevokeOutputShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ outputId, shareId }: { outputId: string; shareId: string }) =>
      revokeOutputShare(outputId, shareId),
    onSuccess: (_result, variables) =>
      queryClient.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.shares(variables.outputId) }),
  });
}
