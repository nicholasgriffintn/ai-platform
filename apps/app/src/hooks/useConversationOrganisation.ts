import type {
  ConversationGroup,
  ConversationGroupScope,
  UpdateConversationOrganisation,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CHATS_QUERY_KEY } from "~/constants";
import {
  createConversationGroup,
  deleteConversationGroup,
  getConversationOrganisation,
  moveConversationToGroup,
  updateConversationOrganisation,
} from "~/lib/api/conversation-organisation";

import { projectQueryKey } from "./useWorkspaces";

const organisationQueryKey = (conversationId: string) => [
  "conversation-organisation",
  conversationId,
];

export function useConversationOrganisation(conversationId: string | null, projectId?: string) {
  const queryClient = useQueryClient();
  const queryOptions = {
    queryKey: organisationQueryKey(conversationId ?? ""),
    queryFn: () => getConversationOrganisation(conversationId ?? ""),
  };
  const query = useQuery({ ...queryOptions, enabled: Boolean(conversationId) });

  const invalidateLists = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [CHATS_QUERY_KEY] }),
      queryClient.invalidateQueries({ queryKey: ["global-search"] }),
      queryClient.invalidateQueries({ queryKey: ["work-attention"] }),
      ...(projectId
        ? [queryClient.invalidateQueries({ queryKey: projectQueryKey(projectId) })]
        : []),
    ]);
  };

  const update = useMutation({
    mutationFn: async (change: Omit<UpdateConversationOrganisation, "expectedRevision">) => {
      if (!conversationId) {
        throw new Error("Conversation organisation is unavailable");
      }

      const current = await queryClient.ensureQueryData(queryOptions);

      return updateConversationOrganisation(conversationId, {
        ...change,
        expectedRevision: current.revision,
      });
    },
    onSuccess: async (organisation) => {
      queryClient.setQueryData(organisationQueryKey(organisation.conversationId), organisation);
      await invalidateLists();
    },
  });

  const move = useMutation({
    mutationFn: (groupId: string | null) => {
      if (!conversationId) {
        throw new Error("Conversation organisation is unavailable");
      }

      return moveConversationToGroup(conversationId, groupId);
    },
    onSuccess: async (organisation) => {
      queryClient.setQueryData(organisationQueryKey(organisation.conversationId), organisation);
      await invalidateLists();
    },
  });

  const createGroup = useMutation({
    mutationFn: ({ name, scope }: { name: string; scope: ConversationGroupScope }) =>
      createConversationGroup(name, scope),
    onSuccess: async () => {
      await query.refetch();
      await invalidateLists();
    },
  });

  const deleteGroup = useMutation({
    mutationFn: (group: ConversationGroup) => deleteConversationGroup(group.id),
    onSuccess: async () => {
      await query.refetch();
      await invalidateLists();
    },
  });

  return {
    query,
    update,
    move,
    createGroup,
    deleteGroup,
    isSaving: update.isPending || move.isPending || createGroup.isPending || deleteGroup.isPending,
  };
}
