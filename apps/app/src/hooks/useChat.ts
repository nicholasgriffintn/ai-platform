import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { CHATS_QUERY_KEY } from "~/constants";
import { apiService } from "~/lib/api/api-service";
import { localChatService } from "~/lib/local/local-chat-service";
import { useChatStore } from "~/state/stores/chatStore";
import type { Conversation, Message } from "~/types";

export function useChats() {
  const { isAuthenticated, isPro, localOnlyMode } = useChatStore();

  const remoteChatsQuery = useQuery({
    queryKey: [CHATS_QUERY_KEY, "remote"],
    queryFn: () => apiService.listChats(),
    enabled: isAuthenticated && isPro && !localOnlyMode,
  });

  const localChatsQuery = useQuery({
    queryKey: [CHATS_QUERY_KEY, "local"],
    queryFn: async () => await localChatService.listLocalChats(),
  });

  const allChats = useMemo(() => {
    const remoteChats = remoteChatsQuery.data || [];
    const localChats = localChatsQuery.data || [];

    if (localOnlyMode || !isAuthenticated) {
      return localChats;
    }

    const remoteIds = new Set(remoteChats.map((chat) => chat.id));
    const uniqueLocalChats = localChats.filter(
      (chat) => !remoteIds.has(chat.id),
    );

    return [...remoteChats, ...uniqueLocalChats];
  }, [
    remoteChatsQuery.data,
    localChatsQuery.data,
    localOnlyMode,
    isAuthenticated,
  ]);

  return {
    data: allChats,
    isLoading: remoteChatsQuery.isLoading || localChatsQuery.isLoading,
  };
}

export function useLocalChats() {
  return useQuery({
    queryKey: [CHATS_QUERY_KEY, "local"],
    queryFn: async () => await localChatService.listLocalChats(),
  });
}

export function useChat(completion_id: string | undefined) {
  const { isAuthenticated, isPro, localOnlyMode } = useChatStore();

  return useQuery({
    queryKey: [CHATS_QUERY_KEY, completion_id],
    queryFn: async () => {
      if (!completion_id) return null;

      const localChat = await localChatService.getLocalChat(completion_id);
      const shouldUseLocalOnly =
        localOnlyMode || (localChat?.isLocalOnly ?? false);

      if (shouldUseLocalOnly || !isAuthenticated || !isPro) {
        return localChat;
      }

      try {
        const remoteChat = await apiService.getChat(completion_id);
        return remoteChat || localChat;
      } catch (error) {
        console.error(
          "Failed to fetch remote chat, falling back to local:",
          error,
        );
        return localChat;
      }
    },
    enabled: !!completion_id,
  });
}

const invalidateAllChatQueries = (queryClient: any, completion_id?: string) => {
  queryClient.invalidateQueries({ queryKey: [CHATS_QUERY_KEY] });
  queryClient.invalidateQueries({ queryKey: [CHATS_QUERY_KEY, "local"] });
  queryClient.invalidateQueries({ queryKey: [CHATS_QUERY_KEY, "remote"] });

  if (completion_id) {
    queryClient.invalidateQueries({
      queryKey: [CHATS_QUERY_KEY, completion_id],
    });
  }
};

export function useDeleteChat() {
  const queryClient = useQueryClient();
  const { isAuthenticated, isPro, localOnlyMode } = useChatStore();

  return useMutation({
    mutationFn: async (completion_id: string) => {
      const localChat = await localChatService.getLocalChat(completion_id);
      const isLocalOnly = localChat?.isLocalOnly || false;

      await localChatService.deleteLocalChat(completion_id);

      if (isAuthenticated && isPro && !localOnlyMode && !isLocalOnly) {
        await apiService.deleteConversation(completion_id);
      }
    },
    onSuccess: (_, completion_id) => {
      invalidateAllChatQueries(queryClient, completion_id);
    },
  });
}

export function useDeleteAllLocalChats() {
  const queryClient = useQueryClient();
  const { setCurrentConversationId } = useChatStore();

  return useMutation({
    mutationFn: async () => {
      await localChatService.deleteAllLocalChats();
    },
    onSuccess: () => {
      setCurrentConversationId(undefined);
      invalidateAllChatQueries(queryClient);
    },
  });
}

export function useDeleteAllRemoteChats() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiService.deleteAllConversations();
    },
    onSuccess: () => {
      invalidateAllChatQueries(queryClient);
    },
  });
}

export function useUpdateChatTitle() {
  const queryClient = useQueryClient();
  const { isAuthenticated, isPro, localOnlyMode } = useChatStore();

  return useMutation({
    mutationFn: async ({
      completion_id,
      title,
    }: {
      completion_id: string;
      title: string;
    }) => {
      await localChatService.updateLocalChatTitle(completion_id, title);

      const localChat = await localChatService.getLocalChat(completion_id);
      const isLocalOnly = localChat?.isLocalOnly || false;

      if (isAuthenticated && isPro && !localOnlyMode && !isLocalOnly) {
        await apiService.updateConversationTitle(completion_id, title);
      }
    },
    onSuccess: (_, { completion_id }) => {
      invalidateAllChatQueries(queryClient, completion_id);
    },
  });
}

export function useGenerateTitle() {
  const queryClient = useQueryClient();
  const { localOnlyMode } = useChatStore();

  return useMutation({
    mutationFn: async ({
      completion_id,
      messages,
    }: {
      completion_id: string;
      messages: Message[];
    }) => {
      const localChat = await localChatService.getLocalChat(completion_id);
      const isLocalOnly = localChat?.isLocalOnly || false;

      let newTitle;
      if (isLocalOnly || localOnlyMode) {
        const firstMessage = messages[0];
        const content =
          typeof firstMessage.content === "string"
            ? firstMessage.content
            : firstMessage.content.map((item) => item.text).join("");
        newTitle = content.slice(0, 30) + (content.length > 30 ? "..." : "");
      } else {
        newTitle = await apiService.generateTitle(completion_id, messages);
      }

      await localChatService.updateLocalChatTitle(completion_id, newTitle);

      return newTitle;
    },

    onMutate: async ({ completion_id }) => {
      await queryClient.cancelQueries({
        queryKey: [CHATS_QUERY_KEY, completion_id],
      });
      await queryClient.cancelQueries({ queryKey: [CHATS_QUERY_KEY] });

      const previousSingleChat = queryClient.getQueryData<Conversation>([
        CHATS_QUERY_KEY,
        completion_id,
      ]);
      const previousAllChats = queryClient.getQueryData<Conversation[]>([
        CHATS_QUERY_KEY,
      ]);

      return { previousSingleChat, previousAllChats };
    },
    onError: (_, { completion_id }, context) => {
      if (context?.previousSingleChat) {
        queryClient.setQueryData(
          [CHATS_QUERY_KEY, completion_id],
          context.previousSingleChat,
        );
      }
      if (context?.previousAllChats) {
        queryClient.setQueryData([CHATS_QUERY_KEY], context.previousAllChats);
      }
    },
    onSuccess: (newTitle, { completion_id }) => {
      queryClient.setQueryData<Conversation>(
        [CHATS_QUERY_KEY, completion_id],
        (oldData) => (oldData ? { ...oldData, title: newTitle } : oldData),
      );

      queryClient.setQueryData<Conversation[]>(
        [CHATS_QUERY_KEY],
        (oldData = []) =>
          oldData.map((chat) =>
            chat.id === completion_id ? { ...chat, title: newTitle } : chat,
          ),
      );
    },
  });
}

export function useSubmitFeedback() {
  return useMutation({
    mutationFn: ({
      completion_id,
      log_id,
      feedback,
      score = 50,
    }: {
      completion_id: string;
      log_id: string;
      feedback: 1 | -1;
      score?: number;
    }) => apiService.submitFeedback(completion_id, log_id, feedback, score),
  });
}
