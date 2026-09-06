import {
  listSavedMessages,
  saveMessage,
  unsaveMessage,
} from "@ngriffin_uk/polychat-library-client";
import type { SavedMessage } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { getErrorMessage } from "~/lib/errors";

export const SAVED_MESSAGES_QUERY_KEY = "saved-messages";

export function useSavedMessages(enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [SAVED_MESSAGES_QUERY_KEY],
    queryFn: async (): Promise<SavedMessage[]> => (await listSavedMessages()).messages,
    enabled,
    staleTime: 1000 * 30,
  });
  const messages: SavedMessage[] = query.data ?? [];
  const savedIds = useMemo(() => new Set(messages.map((message) => message.messageId)), [messages]);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [SAVED_MESSAGES_QUERY_KEY] });

  const toggle = useMutation({
    mutationFn: async (input: { conversationId: string; messageId: string; isSaved: boolean }) => {
      if (input.isSaved) {
        await saveMessage({ conversationId: input.conversationId, messageId: input.messageId });

        return;
      }

      await unsaveMessage(input.messageId);
    },
    onSuccess: invalidate,
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Unable to change what you have kept"));
    },
  });

  return {
    messages,
    savedIds,
    isLoading: query.isLoading,
    error: query.error,
    toggle: (conversationId: string, messageId: string, isSaved: boolean) => {
      toggle.mutate({ conversationId, messageId, isSaved });
    },
  };
}
