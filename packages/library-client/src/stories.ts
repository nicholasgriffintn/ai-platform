import type { EntityPage, StoryPage } from "@ngriffin_uk/polychat-schemas";

import { requestJson } from "./resource.js";

export function getStory(storyId: string): Promise<StoryPage> {
  return requestJson(`/stories/${encodeURIComponent(storyId)}`, "GET");
}

export function getStoryEntity(entityId: string): Promise<EntityPage> {
  return requestJson(`/stories/entities/${encodeURIComponent(entityId)}`, "GET");
}
