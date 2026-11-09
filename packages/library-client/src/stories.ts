import type {
  CoverageTracker,
  EntityPage,
  StoryPage,
  StoryWorld,
} from "@ngriffin_uk/polychat-schemas";

import { requestJson } from "./resource.js";

export function getStory(storyId: string): Promise<StoryPage> {
  return requestJson(`/stories/${encodeURIComponent(storyId)}`, "GET");
}

export function getStoryEntity(entityId: string): Promise<EntityPage> {
  return requestJson(`/stories/entities/${encodeURIComponent(entityId)}`, "GET");
}

export function getStoryWorld(storyId: string): Promise<StoryWorld> {
  return requestJson(`/stories/${encodeURIComponent(storyId)}/world`, "GET");
}

export function getCoverageTracker(weeks?: number): Promise<CoverageTracker> {
  const query = weeks === undefined ? "" : `?weeks=${weeks}`;

  return requestJson(`/stories/tracker${query}`, "GET");
}
