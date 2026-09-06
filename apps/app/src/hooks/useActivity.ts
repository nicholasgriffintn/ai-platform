import { listActivity } from "@ngriffin_uk/polychat-library-client";
import { useInfiniteQuery } from "@tanstack/react-query";

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
