import { useInfiniteQuery } from "@tanstack/react-query";

import { listActivity } from "~/lib/api/activity";

export function useActivity(projectId?: string) {
  const query = useInfiniteQuery({
    queryKey: ["activity", projectId],
    queryFn: ({ pageParam }) => listActivity({ projectId, limit: 50, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore
        ? pages.reduce((count, page) => count + page.activities.length, 0)
        : undefined,
  });

  return {
    ...query,
    data: query.data?.pages.flatMap((page) => page.activities) ?? [],
  };
}
