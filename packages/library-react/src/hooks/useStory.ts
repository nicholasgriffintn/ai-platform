import { getStory } from "@ngriffin_uk/polychat-library-client";
import { useQuery } from "@tanstack/react-query";

const STORY_STALE_MS = 1000 * 60 * 5;

export function useStory(storyId: string | undefined) {
  return useQuery({
    queryKey: ["stories", storyId],
    queryFn: () => getStory(storyId ?? ""),
    enabled: Boolean(storyId),
    staleTime: STORY_STALE_MS,
  });
}
