import {
  filterConversationsByListOptions,
  type ConversationListOptions,
  type ConversationSummary,
} from "@ngriffin_uk/polychat-library-chat/conversations";
import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";

const DEFAULT_CHATS_QUERY_KEY = "chats";

export interface ConversationListPage<T extends ConversationSummary> {
  conversations: T[];
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

type ConversationListUpdater<T> = (conversation: T) => T;

function updateLocalConversationLists<T extends ConversationSummary>(
  queryClient: QueryClient,
  queryKeyRoot: string,
  updater: (oldData: T[] | undefined) => T[] | undefined,
  localScope?: string,
) {
  if (localScope !== undefined) {
    queryClient.setQueryData<T[]>([queryKeyRoot, "local", localScope], updater);

    return;
  }

  const localQueries = queryClient.getQueryCache().findAll({ queryKey: [queryKeyRoot, "local"] });

  for (const query of localQueries) {
    queryClient.setQueryData<T[]>(query.queryKey, updater);
  }
}

function getRemoteListOptions(queryKey: QueryKey): ConversationListOptions {
  const [, , options] = Array.isArray(queryKey) ? queryKey : [];

  if (!options || typeof options !== "object") {
    return {};
  }

  const { archived, query, sortBy } = options as Record<string, unknown>;

  return {
    archived:
      archived === "active" || archived === "archived" || archived === "all" ? archived : undefined,
    query: typeof query === "string" ? query : undefined,
    sortBy: sortBy === "updated" || sortBy === "created" ? sortBy : undefined,
  };
}

function updateRemoteConversationLists<T extends ConversationSummary>(
  queryClient: QueryClient,
  queryKeyRoot: string,
  updater: (
    oldData: InfiniteData<ConversationListPage<T>> | undefined,
    queryKey: QueryKey,
  ) => InfiniteData<ConversationListPage<T>> | undefined,
) {
  const remoteQueries = queryClient.getQueryCache().findAll({ queryKey: [queryKeyRoot, "remote"] });

  for (const query of remoteQueries) {
    queryClient.setQueryData<InfiniteData<ConversationListPage<T>>>(query.queryKey, (oldData) =>
      updater(oldData, query.queryKey),
    );
  }
}

export function upsertConversationInChatCaches<T extends ConversationSummary>(
  queryClient: QueryClient,
  conversation: T,
  options: { includeLocalList: boolean; includeRemoteLists: boolean; localScope?: string },
  queryKeyRoot = DEFAULT_CHATS_QUERY_KEY,
) {
  queryClient.setQueryData([queryKeyRoot, conversation.id], conversation);
  if (options.includeLocalList) {
    updateLocalConversationLists<T>(
      queryClient,
      queryKeyRoot,
      (oldData = []) => [conversation, ...oldData.filter((chat) => chat.id !== conversation.id)],
      options.localScope,
    );
  }

  if (!options.includeRemoteLists) {
    return;
  }

  updateRemoteConversationLists<T>(queryClient, queryKeyRoot, (data, queryKey) => {
    if (!data?.pages.length) {
      return data;
    }

    const pages = data.pages.map((page) => ({
      ...page,
      conversations: page.conversations.filter((chat) => chat.id !== conversation.id),
    }));

    if (filterConversationsByListOptions([conversation], getRemoteListOptions(queryKey)).length) {
      pages[0] = { ...pages[0], conversations: [conversation, ...pages[0].conversations] };
    }

    return { ...data, pages };
  });
}

export function updateConversationInChatCaches<T extends ConversationSummary>(
  queryClient: QueryClient,
  conversationId: string,
  updater: ConversationListUpdater<T>,
  queryKeyRoot = DEFAULT_CHATS_QUERY_KEY,
  localScope?: string,
) {
  queryClient.setQueryData<T>([queryKeyRoot, conversationId], (oldData) =>
    oldData ? updater(oldData) : oldData,
  );
  updateLocalConversationLists<T>(
    queryClient,
    queryKeyRoot,
    (oldData = []) => oldData.map((chat) => (chat.id === conversationId ? updater(chat) : chat)),
    localScope,
  );
  updateRemoteConversationLists<T>(queryClient, queryKeyRoot, (data) =>
    data?.pages.length
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            conversations: page.conversations.map((chat) =>
              chat.id === conversationId ? updater(chat) : chat,
            ),
          })),
        }
      : data,
  );
}

export function removeConversationFromChatCaches<T extends ConversationSummary>(
  queryClient: QueryClient,
  conversationId: string,
  queryKeyRoot = DEFAULT_CHATS_QUERY_KEY,
  localScope?: string,
) {
  queryClient.removeQueries({ queryKey: [queryKeyRoot, conversationId], exact: true });
  updateLocalConversationLists<T>(
    queryClient,
    queryKeyRoot,
    (oldData) => oldData?.filter((chat) => chat.id !== conversationId),
    localScope,
  );
  updateRemoteConversationLists<T>(queryClient, queryKeyRoot, (data) =>
    data?.pages.length
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            conversations: page.conversations.filter((chat) => chat.id !== conversationId),
          })),
        }
      : data,
  );
}
