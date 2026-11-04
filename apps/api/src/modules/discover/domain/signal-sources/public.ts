import { isoDaysBefore } from "@ngriffin_uk/polychat-utility-core";
import { htmlToPlainText } from "@ngriffin_uk/polychat-utility-server/html-text";

import { count, describeEngagement, first, joinParts, lines, records } from "./read";
import type { DiscoverPublicSignal } from "./types";

const HACKER_NEWS_MIN_POINTS = 100;
const LOBSTERS_MIN_SCORE = 10;
const HUGGING_FACE_MIN_UPVOTES = 5;
const HUGGING_FACE_RECENT_DAYS = 14;

function hackerNewsStories(result: unknown): Record<string, unknown>[] {
  return records(result, ["hits"]);
}

function hackerNewsUrl(story: Record<string, unknown>): string {
  return (
    first(story, ["url"]) || `https://news.ycombinator.com/item?id=${first(story, ["objectID"])}`
  );
}

function hackerNewsDiscussion(story: Record<string, unknown>): string | undefined {
  const discussion = `https://news.ycombinator.com/item?id=${first(story, ["objectID"])}`;

  return hackerNewsUrl(story) === discussion ? undefined : discussion;
}

function lobstersStories(result: unknown): Record<string, unknown>[] {
  return records(result);
}

function huggingFacePapers(result: unknown): Record<string, unknown>[] {
  return records(result);
}

function huggingFacePaperUrl(paper: Record<string, unknown>): string {
  const id = first(paper, ["paper", "id"]);

  return id ? `https://huggingface.co/papers/${encodeURIComponent(id)}` : "";
}

export const PUBLIC_SIGNALS: readonly DiscoverPublicSignal[] = [
  {
    kind: "public",
    id: "hackernews-front",
    providerId: "hackernews",
    group: "reading",
    title: "Hacker News",
    description: "Reads the stories on the Hacker News front page.",
    format: "json",
    url: () => "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30",
    items: (result) =>
      hackerNewsStories(result).flatMap((story) => {
        const title = first(story, ["title"]);
        const points = count(story, ["points"]);

        return title && first(story, ["objectID"]) && points >= HACKER_NEWS_MIN_POINTS
          ? [
              {
                title,
                url: hackerNewsUrl(story),
                snippet: htmlToPlainText(first(story, ["story_text"])).slice(0, 400),
                source: describeEngagement("Hacker News", points, "points"),
                date: first(story, ["created_at"]).slice(0, 10),
                discussion: hackerNewsDiscussion(story),
              },
            ]
          : [];
      }),
    digest: (result) =>
      lines(hackerNewsStories(result), (story) =>
        joinParts(first(story, ["title"]), hackerNewsUrl(story)),
      ),
  },
  {
    kind: "public",
    id: "lobsters-hottest",
    providerId: "lobsters",
    group: "reading",
    title: "Lobsters",
    description: "Reads the hottest stories on Lobsters.",
    format: "json",
    url: () => "https://lobste.rs/hottest.json",
    items: (result) =>
      lobstersStories(result).flatMap((story) => {
        const title = first(story, ["title"]);
        const url = first(story, ["url"], ["comments_url"]);
        const score = count(story, ["score"]);

        return title && url && score >= LOBSTERS_MIN_SCORE
          ? [
              {
                title,
                url,
                snippet: first(story, ["description_plain"]).slice(0, 400),
                source: describeEngagement("Lobsters", score, "points"),
                date: first(story, ["created_at"]).slice(0, 10),
                discussion: first(story, ["comments_url"]) || undefined,
              },
            ]
          : [];
      }),
    digest: (result) =>
      lines(lobstersStories(result), (story) =>
        joinParts(first(story, ["title"]), first(story, ["tags"]), first(story, ["url"])),
      ),
  },
  {
    kind: "public",
    id: "huggingface-papers",
    providerId: "huggingface_papers",
    group: "models",
    title: "Hugging Face papers",
    description: "Reads the AI research papers trending on Hugging Face.",
    format: "json",
    url: () => "https://huggingface.co/api/daily_papers?sort=trending&limit=30",
    items: (result, read) =>
      huggingFacePapers(result).flatMap((paper) => {
        const title = first(paper, ["title"], ["paper", "title"]);
        const url = huggingFacePaperUrl(paper);
        const upvotes = count(paper, ["paper", "upvotes"]);
        const published = first(paper, ["publishedAt"]);
        const recent = !published || published >= isoDaysBefore(read.now, HUGGING_FACE_RECENT_DAYS);

        return title && url && upvotes >= HUGGING_FACE_MIN_UPVOTES && recent
          ? [
              {
                title,
                url,
                snippet: first(paper, ["summary"], ["paper", "summary"]).slice(0, 400),
                source: describeEngagement("Hugging Face papers", upvotes, "upvotes"),
                date: published.slice(0, 10),
              },
            ]
          : [];
      }),
    digest: (result) =>
      lines(huggingFacePapers(result), (paper) =>
        joinParts(first(paper, ["title"], ["paper", "title"]), huggingFacePaperUrl(paper)),
      ),
  },
];
