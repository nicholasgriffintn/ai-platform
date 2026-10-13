import { savedItems, useChatStore } from "@ngriffin_uk/polychat-library-client";
import type { SavedItem } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

export const SAVED_ITEMS_QUERY_KEY = "saved-items";

export function useSavedItems(conversationId: string | null | undefined) {
  const queryClient = useQueryClient();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const query = useQuery({
    queryKey: [SAVED_ITEMS_QUERY_KEY, conversationId ?? null],
    queryFn: (): Promise<SavedItem[]> =>
      savedItems.listAll({ conversation_id: conversationId ?? undefined, limit: 100 }),
    enabled: Boolean(conversationId) && isAuthenticated,
    staleTime: 1000 * 30,
  });
  const items = query.data;
  const savedIds = useMemo(() => new Set((items ?? []).map((item) => item.id)), [items]);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [SAVED_ITEMS_QUERY_KEY] });

  const toggle = useMutation({
    mutationFn: async (input: { conversationId: string; itemId: string; isSaved: boolean }) => {
      if (input.isSaved) {
        await savedItems.create({ conversation_id: input.conversationId, item_id: input.itemId });

        return;
      }

      await savedItems.delete(input.itemId);
    },
    onSuccess: invalidate,
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Unable to change what you have kept"));
    },
  });

  return {
    items: items ?? [],
    savedIds,
    isLoading: query.isLoading,
    error: query.error,
    toggle: (conversationId: string, itemId: string, isSaved: boolean) => {
      toggle.mutate({ conversationId, itemId, isSaved });
    },
  };
}
