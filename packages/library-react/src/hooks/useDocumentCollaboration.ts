import {
  applyDocumentEdit,
  createDocumentComment,
  listDocumentComments,
  proposeDocumentEdit,
  resolveDocumentThread,
} from "@ngriffin_uk/polychat-library-client";
import {
  nextPageCursor,
  type CreateDocumentCommentInput,
  type DocumentCommentSubject,
  type DocumentEditProposal,
  type ProposeDocumentEditInput,
  type ResolveDocumentThreadInput,
} from "@ngriffin_uk/polychat-schemas";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useLiveOrPoll } from "../sync/live-or-poll.js";
import { OUTPUT_QUERY_KEYS } from "./useOutputs.js";

export function documentCommentsQueryKey(subject: DocumentCommentSubject) {
  return [subject.type === "output" ? "outputs" : "sources", "comments", subject.id] as const;
}

export function useDocumentCollaboration(subject: DocumentCommentSubject) {
  const liveOrPoll = useLiveOrPoll();
  const client = useQueryClient();
  const outputId = subject.id;
  const queryKey = documentCommentsQueryKey(subject);
  const refresh = () => client.invalidateQueries({ queryKey });
  const comments = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => listDocumentComments(subject, pageParam || undefined),
    initialPageParam: "",
    getNextPageParam: nextPageCursor,
    refetchInterval: (query) => liveOrPoll(query, 15_000, "document_comments.changed"),
  });
  const create = useMutation({
    mutationFn: (input: CreateDocumentCommentInput) => createDocumentComment(subject, input),
    onSettled: () =>
      Promise.all([refresh(), client.invalidateQueries({ queryKey: ["project-tasks"] })]),
  });
  const resolve = useMutation({
    mutationFn: ({ commentId, ...input }: ResolveDocumentThreadInput & { commentId: string }) =>
      resolveDocumentThread(subject, commentId, input),
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
        comments: comments.data?.pages.flatMap((page) => page.data) ?? [],
        permissions: latest.permissions,
      }
    : undefined;

  return { comments: { ...comments, data }, create, resolve, propose, apply };
}
