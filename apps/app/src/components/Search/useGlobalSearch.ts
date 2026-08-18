import { useDebouncedValue } from "@ngriffin_uk/polychat-utility-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useProjectCapabilityCatalog } from "~/hooks/useProjectCapabilityCatalog";
import { searchPolychat } from "~/lib/api/global-search";
import { buildGlobalSearchResults, rankGlobalSearchResults } from "~/lib/global-search";
import { getLocalChatScope } from "~/lib/local/local-chat-scope";
import { localChatService } from "~/lib/local/local-chat-service";
import { useChatStore } from "~/state/stores/chatStore";

const GLOBAL_SEARCH_LIMIT = 8;

export function useGlobalSearch(query: string) {
  const debouncedQuery = useDebouncedValue(query, 180).trim();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const userId = useChatStore((state) => state.user?.id);
  const localScope = getLocalChatScope(userId);
  const catalog = useProjectCapabilityCatalog();
  const remoteQuery = useQuery({
    queryKey: ["global-search", debouncedQuery],
    queryFn: () => searchPolychat(debouncedQuery, GLOBAL_SEARCH_LIMIT),
    enabled: isAuthenticated,
    placeholderData: (previous) => previous,
    staleTime: 30 * 1000,
  });
  const localQuery = useQuery({
    queryKey: ["global-search", "local", localScope],
    queryFn: () => localChatService.listLocalChats(),
    staleTime: 30 * 1000,
  });

  const items = useMemo(
    () =>
      buildGlobalSearchResults({
        capabilities: catalog.items,
        experiences: catalog.experiences,
        localConversations: localQuery.data ?? [],
        remote: remoteQuery.data,
      }),
    [catalog.experiences, catalog.items, localQuery.data, remoteQuery.data],
  );
  const results = useMemo(
    () => rankGlobalSearchResults(items, debouncedQuery),
    [debouncedQuery, items],
  );

  return {
    debouncedQuery,
    error: remoteQuery.error ?? localQuery.error ?? catalog.error,
    isLoading: remoteQuery.isLoading || localQuery.isLoading || catalog.isLoading,
    isUpdating: query.trim() !== debouncedQuery || remoteQuery.isFetching,
    results,
  };
}
