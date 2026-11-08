export const STORY_EDGE_SIMILARITY = 0.82;
export const STORY_EDGE_QUERY_LIMIT = 10;
export const STORY_QUIET_DAYS = 5;
const BACKGROUND_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type StoryEdgeKind = "continues" | "background";

export interface EdgeStory {
  id: string;
  openedAt: string;
  lastArticleAt: string;
  leadEntityIds: readonly string[];
}

export interface StoryEdgeDraft {
  fromStoryId: string;
  toStoryId: string;
  kind: StoryEdgeKind;
  score: number;
}

export function decideStoryEdge(
  story: EdgeStory,
  candidate: EdgeStory,
  score: number,
): StoryEdgeDraft | null {
  if (
    candidate.id === story.id ||
    score < STORY_EDGE_SIMILARITY ||
    candidate.openedAt >= story.openedAt ||
    !candidate.leadEntityIds.some((id) => story.leadEntityIds.includes(id))
  ) {
    return null;
  }

  const gap = Date.parse(story.openedAt) - Date.parse(candidate.lastArticleAt);

  return {
    fromStoryId: story.id,
    toStoryId: candidate.id,
    kind: gap > BACKGROUND_AGE_MS ? "background" : "continues",
    score,
  };
}

export function quietSince(now: Date): string {
  return new Date(now.getTime() - STORY_QUIET_DAYS * 24 * 60 * 60 * 1000).toISOString();
}
