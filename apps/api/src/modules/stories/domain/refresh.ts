export const DISCOVER_STORY_DAILY_VERSION_CAP = 300;
export const STORY_REFRESH_DEBOUNCE_MS = 15 * 60 * 1000;
export const STORY_VERSION_ARTICLE_LIMIT = 12;
const MIN_OUTLETS_FOR_VERSION = 2;
const NEW_ARTICLES_FOR_VERSION = 3;
const STALE_VERSION_MS = 6 * 60 * 60 * 1000;

export interface StoryRefreshState {
  status: "open" | "closed";
  articleCount: number;
  outletCount: number;
  versionedArticleCount: number;
  versionedOutletCount: number;
  versionedAt: string | null;
}

export function needsStoryVersion(story: StoryRefreshState, now: Date): boolean {
  if (story.status !== "open" || story.outletCount < MIN_OUTLETS_FOR_VERSION) {
    return false;
  }

  if (story.outletCount > story.versionedOutletCount) {
    return true;
  }

  const added = story.articleCount - story.versionedArticleCount;

  if (added >= NEW_ARTICLES_FOR_VERSION) {
    return true;
  }

  const versionedAt = story.versionedAt ? Date.parse(story.versionedAt) : Number.NaN;

  return (
    added > 0 && (!Number.isFinite(versionedAt) || now.getTime() - versionedAt >= STALE_VERSION_MS)
  );
}

export function storyRefreshSlot(now: Date): Date {
  return new Date(
    Math.ceil((now.getTime() + 1) / STORY_REFRESH_DEBOUNCE_MS) * STORY_REFRESH_DEBOUNCE_MS,
  );
}

export function startOfUtcDay(now: Date): string {
  return `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

export function pickVersionArticles<T extends { outletId: string; publishedAt: string }>(
  articles: readonly T[],
): T[] {
  const newestFirst = [...articles].sort((left, right) =>
    right.publishedAt.localeCompare(left.publishedAt),
  );
  const firstPerOutlet = new Map<string, T>();

  for (const article of newestFirst) {
    if (!firstPerOutlet.has(article.outletId)) {
      firstPerOutlet.set(article.outletId, article);
    }
  }

  const leads = [...firstPerOutlet.values()];
  const rest = newestFirst.filter((article) => !leads.includes(article));

  return [...leads, ...rest].slice(0, STORY_VERSION_ARTICLE_LIMIT);
}
