import type { StoryPage } from "@ngriffin_uk/polychat-schemas";

import { requestJson } from "./resource.js";

export function getStory(storyId: string): Promise<StoryPage> {
  return requestJson(`/stories/${encodeURIComponent(storyId)}`, "GET");
}
