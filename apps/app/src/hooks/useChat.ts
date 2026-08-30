import {
  filterConversationsByListOptions,
  isLocallyCreatedConversation,
  preserveOptimisticMessages,
} from "@ngriffin_uk/polychat-library-chat/conversations";
import { ApiError } from "@ngriffin_uk/polychat-library-client";
import {
  removeConversationFromChatCaches,
  updateConversationInChatCaches,
} from "@ngriffin_uk/polychat-library-react/conversation-cache";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { CHATS_QUERY_KEY } from "~/constants";
import { apiService } from "~/lib/api/api-service";
import { createTemporaryConversationTitle } from "~/lib/chat/title-source";
import { getLocalChatScope } from "~/lib/local/local-chat-scope";
import { localChatService } from "~/lib/local/local-chat-service";
import { useChatStore } from "~/state/stores/chatStore";
import { useStreamActivityStore } from "~/state/stores/streamActivityStore";
import type { ChatRequestOptions, Conversation, ConversationListOptions, Message } from "~/types";

import { useConversationStorage } from "./useConversationStorage";

const DEFAULT_CHAT_LIST_LIMIT = 30;
const CHAT_LIST_STALE_TIME = 2 * 60 * 1000;
const CHAT_DETAIL_STALE_TIME = 2 * 60 * 1000;
const CHAT_QUERY_GC_TIME = 30 * 60 * 1000;

export function useChats(options: ConversationListOptions = {}) {
  const { isAuthenticated, isPro, localOnlyMode, user } = useChatStore();
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
    queryFn: ({ pageParam }) =>
      apiService.listChats({ ...queryOptions, page: Number(pageParam) || 1 }),
    initialPageParam: 1,
    staleTime: CHAT_LIST_STALE_TIME,
    gcTime: CHAT_QUERY_GC_TIME,
    getNextPageParam: (lastPage) => {
      if (lastPage.pageNumber >= lastPage.totalPages) {
        return undefined;
      }

      return lastPage.pageNumber + 1;
    },
    enabled: isAuthenticated && isPro && !localOnlyMode,
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

    if (localOnlyMode || !isAuthenticated) {
      return { chats: localChats, total: localChats.length };
    }

    const remoteIds = new Set(remoteChats.map((chat) => chat.id));
    const uniqueLocalChats = localChats.filter((chat) => !remoteIds.has(chat.id));
    const remoteTotal = remoteChatsQuery.data?.pages[0]?.total ?? remoteChats.length;

    return {
      chats: [...remoteChats, ...uniqueLocalChats],
      total: remoteTotal + uniqueLocalChats.length,
    };
  }, [remoteChatsQuery.data, localChatsQuery.data, localOnlyMode, isAuthenticated, queryOptions]);

  return {
    data: allChats,
    total,
    error: remoteChatsQuery.error ?? localChatsQuery.error,
    fetchNextPage: remoteChatsQuery.fetchNextPage,
    hasNextPage: remoteChatsQuery.hasNextPage && !localOnlyMode && isAuthenticated && isPro,
    isFetchingNextPage: remoteChatsQuery.isFetchingNextPage,
    isLoading: remoteChatsQuery.isLoading || localChatsQuery.isLoading,
    refetch: () => {
      void localChatsQuery.refetch();
      void remoteChatsQuery.refetch();
    },
  };
}

export function useChat(completion_id: string | undefined) {
  const {
    isAuthenticated,
    isPro,
    localOnlyMode,
    locallyCreatedConversationIds,
    markConversationRemoteAvailable,
  } = useChatStore();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [CHATS_QUERY_KEY, completion_id],
    queryFn: async () => {
      if (!completion_id) {
        return null;
      }

      const getCachedConversation = () =>
        queryClient.getQueryData<Conversation>([CHATS_QUERY_KEY, completion_id]);
      const localChat = await localChatService.getLocalChat(completion_id);
      const shouldUseLocalOnly = localOnlyMode || (localChat?.isLocalOnly ?? false);
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

        return preserveOptimisticMessages(remoteChat || localChat, getCachedConversation());
      } catch (error) {
        if (error instanceof ApiError || !localChat) {
          throw error;
        }

        console.warn("Remote chat is temporarily unavailable; using the local copy.", error);

        return preserveOptimisticMessages(localChat, getCachedConversation());
      }
    },
    enabled: !!completion_id,
    staleTime: CHAT_DETAIL_STALE_TIME,
    gcTime: CHAT_QUERY_GC_TIME,
    refetchInterval: (query) => {
      const data = query.state.data;

      if (!data?.messages) {
        return false;
      }

      const pendingMessages = data.messages.filter((message) => {
        if (message.status !== "in_progress") {
          return false;
        }

        const asyncInvocation = message.data?.asyncInvocation;

        return Boolean(asyncInvocation?.provider);
      });

      if (!pendingMessages.length) {
        return false;
      }

      const pollIntervals = pendingMessages
        .map((message) => {
          const asyncInvocation = message.data?.asyncInvocation;

          return asyncInvocation?.pollIntervalMs;
        })
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

      if (!pollIntervals.length) {
        return 6000;
      }

      return Math.max(6000, Math.min(...pollIntervals));
    },
    refetchIntervalInBackground: true,
  });
}

export function useDeleteChat() {
  const queryClient = useQueryClient();
  const {
    currentConversationId,
    isAuthenticated,
    isPro,
    localOnlyMode,
    setCurrentConversationId,
    user,
  } = useChatStore();

  return useMutation({
    mutationFn: async (completion_id: string) => {
      const localChat = await localChatService.getLocalChat(completion_id);
      const isLocalOnly = localChat?.isLocalOnly || false;

      if (isAuthenticated && isPro && !localOnlyMode && !isLocalOnly) {
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
  const { isAuthenticated, isPro, localOnlyMode, user } = useChatStore();

  return useMutation({
    mutationFn: async ({
      archived,
      options = {},
    }: {
      archived: boolean;
      options?: ConversationListOptions;
    }) => {
      const local = await localChatService.setLocalChatsArchived(archived, options);

      if (!isAuthenticated || !isPro || localOnlyMode) {
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
  const { isAuthenticated, isPro, localOnlyMode, user } = useChatStore();

  return useMutation({
    mutationFn: async ({ completion_id, title }: { completion_id: string; title: string }) => {
      await localChatService.updateLocalChatTitle(completion_id, title);

      const localChat = await localChatService.getLocalChat(completion_id);
      const isLocalOnly = localChat?.isLocalOnly || false;

      if (isAuthenticated && isPro && !localOnlyMode && !isLocalOnly) {
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

      const storageMode = determineStorageMode();
      let newTitle;

      if (!storageMode.shouldSyncRemote || (isLocalOnly && !storageMode.isProjectScoped)) {
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
