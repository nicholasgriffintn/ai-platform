import {
  getCoverageTracker,
  getStory,
  getStoryEntity,
  getStoryWorld,
} from "@ngriffin_uk/polychat-library-client";
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

export function useStoryEntity(entityId: string | undefined) {
  return useQuery({
    queryKey: ["stories", "entities", entityId],
    queryFn: () => getStoryEntity(entityId ?? ""),
    enabled: Boolean(entityId),
    staleTime: STORY_STALE_MS,
  });
}

export function useStoryWorld(storyId: string | undefined) {
  return useQuery({
    queryKey: ["stories", storyId, "world"],
    queryFn: () => getStoryWorld(storyId ?? ""),
    enabled: Boolean(storyId),
    staleTime: STORY_STALE_MS,
  });
}

export function useCoverageTracker(weeks: number, enabled = true) {
  return useQuery({
    queryKey: ["stories", "tracker", weeks],
    queryFn: () => getCoverageTracker(weeks),
    enabled,
    staleTime: STORY_STALE_MS,
  });
}
