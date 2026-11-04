import { epochSecondsToIso, isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { DiscoverResearchResult } from "../research";
import { count, describeEngagement, first, items, joinParts, lines } from "./read";
import type { DiscoverSignal } from "./types";

const REDDIT_TOPIC_LIMIT = 5;
const REDDIT_FRONT_MIN_SCORE = 20;
const REDDIT_TOPIC_MIN_SCORE = 50;
const REDDIT_MEDIA_HINTS = new Set(["hosted:video", "image", "rich:video"]);
const REDDIT_MEDIA_URL = /^https?:\/\/(?:i|preview|v)\.redd\.it\//u;

function redditPosts(result: unknown): Record<string, unknown>[] {
  return items(
    result,
    ["data", "posts"],
    ["posts"],
    ["data", "data", "children"],
    ["data", "children"],
    ["children"],
  ).flatMap((child) => {
    const post = isRecord(child) && isRecord(child.data) ? child.data : child;

    return isRecord(post) && post.over_18 !== true && post.stickied !== true ? [post] : [];
  });
}

function redditPostUrl(post: Record<string, unknown>): string {
  const permalink = first(post, ["permalink"]);

  if (!permalink || /^https?:\/\//u.test(permalink)) {
    return permalink;
  }

  return `https://www.reddit.com${permalink.startsWith("/") ? "" : "/"}${permalink}`;
}

function redditSubreddit(post: Record<string, unknown>): string {
  const subreddit = first(post, ["subreddit_name_prefixed"], ["subreddit_prefixed"], ["subreddit"]);

  return subreddit.startsWith("r/") || !subreddit ? subreddit : `r/${subreddit}`;
}

function isBareMediaPost(post: Record<string, unknown>): boolean {
  return (
    !first(post, ["selftext"]) &&
    (post.is_gallery === true ||
      post.is_video === true ||
      REDDIT_MEDIA_HINTS.has(first(post, ["post_hint"])) ||
      REDDIT_MEDIA_URL.test(first(post, ["url"])))
  );
}

function redditPostItems(
  posts: readonly Record<string, unknown>[],
  minScore: number,
): DiscoverResearchResult[] {
  return posts.flatMap((post) => {
    const title = first(post, ["title"]);
    const url = redditPostUrl(post);
    const score = count(post, ["score"]);

    return title && url && score >= minScore && !isBareMediaPost(post)
      ? [
          {
            title,
            url,
            snippet: first(post, ["selftext"]).slice(0, 1_200),
            source: describeEngagement(redditSubreddit(post), score, "points"),
            date: epochSecondsToIso(post.created_utc)?.slice(0, 10) ?? "",
          },
        ]
      : [];
  });
}

function redditPostLines(posts: Record<string, unknown>[]): string[] {
  return lines(posts, (post) =>
    joinParts(first(post, ["title"]), redditSubreddit(post), redditPostUrl(post)),
  );
}

export const REDDIT_SIGNALS: readonly DiscoverSignal[] = [
  {
    id: "reddit-front",
    providerId: "reddit",
    group: "social",
    title: "Reddit",
    description: "Reads the best posts from the communities you subscribe to.",
    operation: "REDDIT_GET",
    parameters: () => ({ sort: "best", limit: 25 }),
    items: (result) => redditPostItems(redditPosts(result), REDDIT_FRONT_MIN_SCORE),
    digest: (result) => redditPostLines(redditPosts(result)),
  },
  {
    id: "reddit-topics",
    providerId: "reddit",
    group: "social",
    title: "Reddit on your topics",
    description:
      "Reads this week's top Reddit posts about the topics you follow and keep coming back to.",
    operation: "REDDIT_SEARCH_ACROSS_SUBREDDITS",
    needsTopics: true,
    parameters: ({ topics }) => ({
      search_query: topics
        .slice(0, REDDIT_TOPIC_LIMIT)
        .map((topic) => `"${topic.replace(/"/gu, "")}"`)
        .join(" OR "),
      sort: "top",
      time_filter: "week",
      limit: 25,
    }),
    items: (result) => redditPostItems(redditPosts(result), REDDIT_TOPIC_MIN_SCORE),
    digest: (result) => redditPostLines(redditPosts(result)),
  },
];
