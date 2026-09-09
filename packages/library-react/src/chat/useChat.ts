import { getLocalChatScope } from "@ngriffin_uk/polychat-library-chat";
import type {
  ChatRequestOptions,
  Conversation,
  ConversationListOptions,
  Message,
} from "@ngriffin_uk/polychat-library-chat/conversation-types";
import {
  filterConversationsByListOptions,
  isLocallyCreatedConversation,
  preserveOptimisticMessages,
} from "@ngriffin_uk/polychat-library-chat/conversations";
import {
  ApiError,
  CHATS_QUERY_KEY,
  apiService,
  useChatStore,
  useStreamActivityStore,
} from "@ngriffin_uk/polychat-library-client";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { getConversationRefetchInterval } from "../chat/conversation-polling.js";
import { recoverUnacknowledgedConversation } from "../chat/pending-conversation.js";
import { createTemporaryConversationTitle } from "../chat/title-source.js";
import {
  removeConversationFromChatCaches,
  updateConversationInChatCaches,
} from "../conversation-cache.js";
import { localChatService } from "../index.js";
import { liveOrPoll } from "../sync/live-or-poll.js";
import { useConversationStorage } from "./useConversationStorage.js";

const DEFAULT_CHAT_LIST_LIMIT = 30;
const CHAT_LIST_STALE_TIME = 2 * 60 * 1000;
const CHAT_DETAIL_STALE_TIME = 2 * 60 * 1000;
const CHAT_QUERY_GC_TIME = 30 * 60 * 1000;

export function useChats(options: ConversationListOptions = {}) {
  const { currentConversationId, isAuthenticated, isPro, locallyCreatedConversationIds, user } =
    useChatStore();
  const localScope = getLocalChatScope(user?.id);
  const queryOptions = useMemo<Omit<ConversationListOptions, "page">>(
    () => ({
      activity: options.activity ?? "all",
      archived: options.archived ?? "active",
      limit: options.limit ?? DEFAULT_CHAT_LIST_LIMIT,
      query: options.query?.trim() || undefined,
      sortBy: options.sortBy ?? "updated",
    }),
    [options.activity, options.archived, options.limit, options.query, options.sortBy],
  );

  const remoteChatsQuery = useInfiniteQuery({
    queryKey: [CHATS_QUERY_KEY, "remote", queryOptions],
    queryFn: ({ pageParam }) => apiService.listChats({ ...queryOptions, page: pageParam || 1 }),
    initialPageParam: 1,
    staleTime: CHAT_LIST_STALE_TIME,
    gcTime: CHAT_QUERY_GC_TIME,
    getNextPageParam: (lastPage) => {
      if (lastPage.pageNumber >= lastPage.totalPages) {
        return undefined;
      }

      return lastPage.pageNumber + 1;
    },
    enabled: isAuthenticated && isPro,
  });

  const localChatsQuery = useQuery({
    queryKey: [CHATS_QUERY_KEY, "local", localScope],
    queryFn: async () => await localChatService.listLocalChats(),
    staleTime: CHAT_LIST_STALE_TIME,
    gcTime: CHAT_QUERY_GC_TIME,
  });

  const { chats: allChats, total } = useMemo(() => {
    const remoteChats = remoteChatsQuery.data?.pages.flatMap((page) => page.conversations) || [];
    const localChats = filterConversationsByListOptions(localChatsQuery.data || [], queryOptions);

    if (!isAuthenticated) {
      return { chats: localChats, total: localChats.length };
    }

    const remoteIds = new Set(remoteChats.map((chat) => chat.id));
    const uniqueLocalChats = localChats.filter(
      (chat) =>
        !remoteIds.has(chat.id) &&
        (chat.isLocalOnly ||
          chat.id === currentConversationId ||
          Boolean(chat.id && locallyCreatedConversationIds[chat.id])),
    );
    const remoteTotal = remoteChatsQuery.data?.pages[0]?.total ?? remoteChats.length;

    return {
      chats: [...remoteChats, ...uniqueLocalChats],
      total: remoteTotal + uniqueLocalChats.length,
    };
  }, [
    remoteChatsQuery.data,
    localChatsQuery.data,
    isAuthenticated,
    queryOptions,
    currentConversationId,
    locallyCreatedConversationIds,
  ]);

  return {
    data: allChats,
    total,
    error: remoteChatsQuery.error ?? localChatsQuery.error,
    fetchNextPage: remoteChatsQuery.fetchNextPage,
    hasNextPage: remoteChatsQuery.hasNextPage && isAuthenticated && isPro,
    isFetchingNextPage: remoteChatsQuery.isFetchingNextPage,
    isLoading: remoteChatsQuery.isLoading || localChatsQuery.isLoading,
    refetch: () => {
      void localChatsQuery.refetch();
      void remoteChatsQuery.refetch();
    },
  };
}

export function useChat(
  completion_id: string | undefined,
  options: { monitorRemoteActivity?: boolean } = {},
) {
  const {
    isAuthenticated,
    isAuthenticationLoading,
    isPro,
    locallyCreatedConversationIds,
    markConversationRemoteAvailable,
    currentConversationId,
    setConversationModelSelection,
  } = useChatStore();
  const queryClient = useQueryClient();
  const streamSource = useStreamActivityStore((state) =>
    completion_id ? state.streams[completion_id]?.source : undefined,
  );

  const query = useQuery({
    queryKey: [CHATS_QUERY_KEY, completion_id],
    queryFn: async () => {
      if (!completion_id) {
        return null;
      }

      const getCachedConversation = () =>
        queryClient.getQueryData<Conversation>([CHATS_QUERY_KEY, completion_id]);
      const localChat = await localChatService.getLocalChat(completion_id);
      const shouldUseLocalOnly = localChat?.isLocalOnly ?? false;
      const cachedConversation = getCachedConversation();

      if (shouldUseLocalOnly || !isAuthenticated || !isPro) {
        return preserveOptimisticMessages(localChat, cachedConversation);
      }

      if (isLocallyCreatedConversation(completion_id, locallyCreatedConversationIds)) {
        return preserveOptimisticMessages(localChat, cachedConversation);
      }

      try {
        const remoteChat = await apiService.getChat(completion_id, {
          refreshPending: true,
        });

        if (remoteChat) {
          markConversationRemoteAvailable(completion_id);
        }

        const stream = useStreamActivityStore.getState().streams[completion_id];

        if (!stream || stream.source === "remote") {
          const unacknowledged = recoverUnacknowledgedConversation(localChat, remoteChat);

          if (unacknowledged) {
            return unacknowledged;
          }
        }

        if (remoteChat?.active_operation === null && (!stream || stream.source === "remote")) {
          return remoteChat;
        }

        const conversation = preserveOptimisticMessages(
          remoteChat || localChat,
          getCachedConversation() || localChat,
        );

        return conversation && { ...conversation, active_operation: remoteChat?.active_operation };
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          const unacknowledged = recoverUnacknowledgedConversation(localChat);

          if (unacknowledged) {
            return unacknowledged;
          }
        }

        if (error instanceof ApiError || !localChat) {
          throw error;
        }

        console.warn("Remote chat is temporarily unavailable; using the local copy.", error);

        return preserveOptimisticMessages(localChat, getCachedConversation());
      }
    },
    enabled: !!completion_id && !isAuthenticationLoading,
    staleTime: CHAT_DETAIL_STALE_TIME,
    gcTime: CHAT_QUERY_GC_TIME,
    refetchInterval: (currentQuery) =>
      options.monitorRemoteActivity && streamSource !== "local"
        ? liveOrPoll(
            currentQuery,
            getConversationRefetchInterval(currentQuery.state.data),
            "conversation.changed",
          )
        : false,
    refetchOnMount: "always",
    refetchIntervalInBackground: options.monitorRemoteActivity === true,
  });

  useEffect(() => {
    if (!completion_id || completion_id !== currentConversationId || !query.data) {
      return;
    }

    setConversationModelSelection({
      model: query.data.model,
      modelTier: query.data.model_tier,
      permissionMode: query.data.permission_mode,
    });
  }, [completion_id, currentConversationId, query.data, setConversationModelSelection]);

  return query;
}

export function useLoadEarlierChatMessages(completionId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const conversation = completionId
        ? queryClient.getQueryData<Conversation>([CHATS_QUERY_KEY, completionId])
        : undefined;
      const beforeMessageId = conversation?.oldest_message_id;

      if (!completionId || !beforeMessageId) {
        throw new Error("No earlier conversation page is available");
      }

      return apiService.getEarlierChatMessages(completionId, beforeMessageId);
    },
    onSuccess: (page) => {
      if (!completionId) {
        return;
      }

      queryClient.setQueryData<Conversation>([CHATS_QUERY_KEY, completionId], (conversation) => {
        if (!conversation) {
          return conversation;
        }

        const existingIds = new Set(conversation.messages.map((message) => message.id));
        const earlierMessages = page.messages.filter(
          (message) => !message.id || !existingIds.has(message.id),
        );

        return {
          ...conversation,
          messages: [...earlierMessages, ...conversation.messages],
          has_more_messages: page.hasMore,
          oldest_message_id:
            page.oldestMessageId ?? earlierMessages[0]?.id ?? conversation.oldest_message_id,
        };
      });
    },
  });
}

export function useDeleteChat() {
  const queryClient = useQueryClient();
  const { currentConversationId, isAuthenticated, isPro, setCurrentConversationId, user } =
    useChatStore();

  return useMutation({
    mutationFn: async (completion_id: string) => {
      const localChat = await localChatService.getLocalChat(completion_id);
      const isLocalOnly = localChat?.isLocalOnly || false;

      if (isAuthenticated && isPro && !isLocalOnly) {
        await apiService.deleteConversation(completion_id);
      }

      await localChatService.deleteLocalChat(completion_id);
    },
    onSuccess: (_, completion_id) => {
      useStreamActivityStore.getState().clearStreamStatus(completion_id);

      if (currentConversationId === completion_id) {
        setCurrentConversationId(undefined);
      }

      removeConversationFromChatCaches(
        queryClient,
        completion_id,
        CHATS_QUERY_KEY,
        getLocalChatScope(user?.id),
      );
    },
  });
}

export function useSetAllChatsArchived() {
  const queryClient = useQueryClient();
  const { isAuthenticated, isPro, user } = useChatStore();

  return useMutation({
    mutationFn: async ({
      archived,
      options = {},
    }: {
      archived: boolean;
      options?: ConversationListOptions;
    }) => {
      const local = await localChatService.setLocalChatsArchived(archived, options);

      if (!isAuthenticated || !isPro) {
        return local;
      }

      const remote = await apiService.setAllConversationsArchived({
        archived,
        activity: options.activity,
        query: options.query,
      });

      return local + remote;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CHATS_QUERY_KEY, "remote"] });
      void queryClient.invalidateQueries({
        queryKey: [CHATS_QUERY_KEY, "local", getLocalChatScope(user?.id)],
      });
    },
  });
}

export function useDeleteAllLocalChats() {
  const queryClient = useQueryClient();
  const { setCurrentConversationId, user } = useChatStore();

  return useMutation({
    mutationFn: async () => {
      await localChatService.deleteAllLocalChats();
    },
    onSuccess: () => {
      setCurrentConversationId(undefined);
      queryClient.setQueryData([CHATS_QUERY_KEY, "local", getLocalChatScope(user?.id)], []);
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
      void queryClient.invalidateQueries({ queryKey: [CHATS_QUERY_KEY, "remote"] });
    },
  });
}

export function useUpdateChatTitle() {
  const queryClient = useQueryClient();
  const { isAuthenticated, isPro, user } = useChatStore();

  return useMutation({
    mutationFn: async ({ completion_id, title }: { completion_id: string; title: string }) => {
      await localChatService.updateLocalChatTitle(completion_id, title);

      const localChat = await localChatService.getLocalChat(completion_id);
      const isLocalOnly = localChat?.isLocalOnly || false;

      if (isAuthenticated && isPro && !isLocalOnly) {
        await apiService.updateConversationTitle(completion_id, title);
      }
    },
    onSuccess: (_, { completion_id, title }) => {
      updateConversationInChatCaches(
        queryClient,
        completion_id,
        (chat) => ({
          ...chat,
          title,
        }),
        CHATS_QUERY_KEY,
        getLocalChatScope(user?.id),
      );
    },
  });
}

export function useGenerateTitle(requestOptions?: ChatRequestOptions) {
  const queryClient = useQueryClient();
  const { determineStorageMode } = useConversationStorage(requestOptions);
  const { user } = useChatStore();

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

      const storageMode = determineStorageMode(completion_id);
      let newTitle;

      if (storageMode.retention !== "kept" || (isLocalOnly && !storageMode.isProjectScoped)) {
        newTitle = createTemporaryConversationTitle(messages);
      } else {
        newTitle = await apiService.generateTitle(completion_id, messages);
      }

      await localChatService.updateLocalChatTitle(completion_id, newTitle);

      return newTitle;
    },

    onSuccess: (newTitle, { completion_id }) => {
      updateConversationInChatCaches(
        queryClient,
        completion_id,
        (chat) => ({
          ...chat,
          title: newTitle,
        }),
        CHATS_QUERY_KEY,
        getLocalChatScope(user?.id),
      );
    },
  });
}
