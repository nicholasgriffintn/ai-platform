import { listActivity } from "@ngriffin_uk/polychat-library-client";
import { nextPageCursor } from "@ngriffin_uk/polychat-schemas";
import { useInfiniteQuery } from "@tanstack/react-query";

export function useActivity(projectId?: string) {
  const query = useInfiniteQuery({
    queryKey: ["activity", projectId],
    queryFn: ({ pageParam }) => listActivity({ projectId, limit: 50, after: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextPageCursor,
  });

  return {
    ...query,
    data: query.data?.pages.flatMap((page) => page.data) ?? [],
  };
}
