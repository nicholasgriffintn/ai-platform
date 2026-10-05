import {
  applyDocumentEdit,
  createDocumentComment,
  listDocumentComments,
  proposeDocumentEdit,
  resolveDocumentThread,
} from "@ngriffin_uk/polychat-library-client";
import type {
  CreateDocumentCommentInput,
  DocumentEditProposal,
  ProposeDocumentEditInput,
  ResolveDocumentThreadInput,
} from "@ngriffin_uk/polychat-schemas";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { OUTPUT_QUERY_KEYS } from "./useOutputs.js";

export function useDocumentCollaboration(outputId: string) {
  const client = useQueryClient();
  const queryKey = ["outputs", "comments", outputId];
  const refresh = () => client.invalidateQueries({ queryKey });
  const comments = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => listDocumentComments(outputId, pageParam || undefined),
    initialPageParam: "",
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    refetchInterval: 15_000,
  });
  const create = useMutation({
    mutationFn: (input: CreateDocumentCommentInput) => createDocumentComment(outputId, input),
    onSettled: () =>
      Promise.all([refresh(), client.invalidateQueries({ queryKey: ["project-tasks"] })]),
  });
  const resolve = useMutation({
    mutationFn: ({ commentId, ...input }: ResolveDocumentThreadInput & { commentId: string }) =>
      resolveDocumentThread(outputId, commentId, input),
    onSettled: refresh,
  });
  const propose = useMutation({
    mutationFn: (input: ProposeDocumentEditInput) => proposeDocumentEdit(outputId, input),
  });
  const apply = useMutation({
    mutationFn: (proposal: DocumentEditProposal) => applyDocumentEdit(outputId, proposal),
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.detail(outputId) }),
        client.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.history(outputId) }),
        client.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.all }),
      ]),
  });

  const latest = comments.data?.pages.at(-1);
  const data = latest
    ? {
        comments: comments.data?.pages.flatMap((page) => page.comments) ?? [],
        permissions: latest.permissions,
      }
    : undefined;

  return { comments: { ...comments, data }, create, resolve, propose, apply };
}
