export const STORY_EDGE_SIMILARITY = 0.7;
export const STORY_EDGE_UNSHARED_SIMILARITY = 0.78;
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
  const shared = candidate.leadEntityIds.some((id) => story.leadEntityIds.includes(id));

  if (
    candidate.id === story.id ||
    candidate.openedAt === story.openedAt ||
    score < (shared ? STORY_EDGE_SIMILARITY : STORY_EDGE_UNSHARED_SIMILARITY)
  ) {
    return null;
  }

  const [newer, older] =
    candidate.openedAt < story.openedAt ? [story, candidate] : [candidate, story];
  const gap = Date.parse(newer.openedAt) - Date.parse(older.lastArticleAt);

  return {
    fromStoryId: newer.id,
    toStoryId: older.id,
    kind: gap > BACKGROUND_AGE_MS ? "background" : "continues",
    score,
  };
}

export function quietSince(now: Date): string {
  return new Date(now.getTime() - STORY_QUIET_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export const STORY_MERGE_SIMILARITY = 0.75;
const MERGE_WINDOW_MS = 72 * 60 * 60 * 1000;

export interface MergeCandidate extends EdgeStory {
  status: "open" | "closed";
  articleCount: number;
}

export function decideStoryMerge(
  story: MergeCandidate,
  candidate: MergeCandidate,
  score: number,
): { fromStoryId: string; intoStoryId: string } | null {
  const gap =
    Math.max(Date.parse(story.openedAt), Date.parse(candidate.openedAt)) -
    Math.min(Date.parse(story.lastArticleAt), Date.parse(candidate.lastArticleAt));

  if (
    candidate.id === story.id ||
    story.status !== "open" ||
    candidate.status !== "open" ||
    score < STORY_MERGE_SIMILARITY ||
    gap > MERGE_WINDOW_MS ||
    !candidate.leadEntityIds.some((id) => story.leadEntityIds.includes(id))
  ) {
    return null;
  }

  const keepStory =
    story.articleCount > candidate.articleCount ||
    (story.articleCount === candidate.articleCount && story.openedAt <= candidate.openedAt);

  return keepStory
    ? { fromStoryId: candidate.id, intoStoryId: story.id }
    : { fromStoryId: story.id, intoStoryId: candidate.id };
}
