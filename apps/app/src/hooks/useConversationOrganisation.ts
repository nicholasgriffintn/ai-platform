import type {
  ConversationLabel,
  ConversationLabelScope,
  UpdateConversationOrganisation,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CHATS_QUERY_KEY } from "~/constants";
import {
  createConversationLabel,
  deleteConversationLabel,
  getConversationOrganisation,
  setConversationLabel,
  updateConversationOrganisation,
} from "~/lib/api/conversation-organisation";

import { projectQueryKey } from "./useWorkspaces";

const organisationQueryKey = (conversationId: string) => [
  "conversation-organisation",
  conversationId,
];

export function useConversationOrganisation(conversationId: string | null, projectId?: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: organisationQueryKey(conversationId ?? ""),
    queryFn: () => getConversationOrganisation(conversationId ?? ""),
    enabled: Boolean(conversationId),
  });

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
    mutationFn: (change: Omit<UpdateConversationOrganisation, "expectedRevision">) => {
      if (!conversationId || !query.data) {
        throw new Error("Conversation organisation is unavailable");
      }

      return updateConversationOrganisation(conversationId, {
        ...change,
        expectedRevision: query.data.revision,
      });
    },
    onSuccess: async (organisation) => {
      queryClient.setQueryData(organisationQueryKey(organisation.conversationId), organisation);
      await invalidateLists();
    },
  });

  const assignment = useMutation({
    mutationFn: ({ labelId, assigned }: { labelId: string; assigned: boolean }) => {
      if (!conversationId) {
        throw new Error("Conversation organisation is unavailable");
      }

      return setConversationLabel(conversationId, labelId, assigned);
    },
    onSuccess: async (organisation) => {
      queryClient.setQueryData(organisationQueryKey(organisation.conversationId), organisation);
      await invalidateLists();
    },
  });

  const createLabel = useMutation({
    mutationFn: ({ name, scope }: { name: string; scope: ConversationLabelScope }) =>
      createConversationLabel(name, scope),
    onSuccess: async () => {
      await query.refetch();
      await invalidateLists();
    },
  });

  const deleteLabel = useMutation({
    mutationFn: (label: ConversationLabel) => deleteConversationLabel(label.id),
    onSuccess: async () => {
      await query.refetch();
      await invalidateLists();
    },
  });

  return {
    query,
    update,
    assignment,
    createLabel,
    deleteLabel,
    isSaving:
      update.isPending || assignment.isPending || createLabel.isPending || deleteLabel.isPending,
  };
}
