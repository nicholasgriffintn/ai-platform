import {
  dismissDiscoverItem,
  getDiscoverFeed,
  markDiscoverSeen,
  refreshDiscoverCurrent,
  updateDiscoverDayProfile,
} from "@ngriffin_uk/polychat-library-client";
import {
  nextPageCursor,
  type DiscoverFeedPage,
  type DiscoverResponse,
  type DiscoverSeenRequest,
  type UpdateDiscoverDayProfile,
} from "@ngriffin_uk/polychat-schemas";
import { uniqueBy } from "@ngriffin_uk/polychat-utility-core";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { DISCOVER_QUERY_KEY } from "./useDiscover.js";

export function useUpdateDiscoverDay() {
  const queries = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateDiscoverDayProfile) => updateDiscoverDayProfile(input),
    onSuccess: (dayProfile) => {
      queries.setQueryData<DiscoverResponse>(DISCOVER_QUERY_KEY, (current) =>
        current ? { ...current, dayProfile } : current,
      );
    },
    onSettled: () => queries.invalidateQueries({ queryKey: DISCOVER_QUERY_KEY }),
  });
}

export function useRefreshDiscoverCurrent() {
  const queries = useQueryClient();

  return useMutation({
    mutationFn: () => refreshDiscoverCurrent(),
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: DISCOVER_QUERY_KEY });
    },
  });
}

export function useDismissDiscoverItem() {
  const queries = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => dismissDiscoverItem(itemId),
    onSuccess: (_result, itemId) => {
      queries.setQueryData<DiscoverResponse>(DISCOVER_QUERY_KEY, (current) =>
        current?.feed
          ? {
              ...current,
              feed: {
                ...current.feed,
                data: current.feed.data.filter((item) => item.id !== itemId),
              },
            }
          : current,
      );
      void queries.invalidateQueries({ queryKey: DISCOVER_QUERY_KEY });
    },
  });
}

export function useMarkDiscoverSeen() {
  const queries = useQueryClient();

  return useMutation({
    mutationFn: (input: DiscoverSeenRequest) => markDiscoverSeen(input),
    onSuccess: (_result, input) => {
      const seen = new Map(input.items.map((item) => [item.id, item.revision]));

      queries.setQueryData<DiscoverResponse>(DISCOVER_QUERY_KEY, (current) =>
        current?.feed
          ? {
              ...current,
              feed: {
                ...current.feed,
                data: current.feed.data.map((item) =>
                  seen.get(item.id) === item.revision ? { ...item, seen: true } : item,
                ),
              },
            }
          : current,
      );
    },
  });
}

export function useDiscoverFeedPages(
  first: DiscoverFeedPage | undefined,
  profileRevision: number | undefined,
) {
  const query = useInfiniteQuery({
    queryKey: [...DISCOVER_QUERY_KEY, "feed", first?.updatedAt, profileRevision],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      getDiscoverFeed({ after: pageParam }),
    initialPageParam: undefined,
    initialData: first ? { pages: [first], pageParams: [undefined] } : undefined,
    getNextPageParam: nextPageCursor,
    enabled: Boolean(first),
    staleTime: Infinity,
  });
  const pages = query.data?.pages;
  const items = useMemo(
    () =>
      uniqueBy(
        [...(first?.data ?? []), ...(pages?.slice(1).flatMap((page) => page.data) ?? [])],
        (item) => item.id,
      ),
    [first, pages],
  );

  return {
    items,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    error: query.error,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        void query.fetchNextPage();
      }
    },
  };
}
