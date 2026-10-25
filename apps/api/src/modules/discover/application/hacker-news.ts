import { z } from "zod";

const HACKER_NEWS_API = "https://hacker-news.firebaseio.com/v0";
const FRONT_PAGE_LIMIT = 15;

const storyIdsSchema = z.array(z.number().int());
const storySchema = z.object({
  id: z.number().int(),
  title: z.string().min(1),
  url: z.string().url().optional(),
  score: z.number().optional(),
  descendants: z.number().optional(),
});

export type HackerNewsStory = z.infer<typeof storySchema>;

async function readJson(path: string): Promise<unknown> {
  const response = await fetch(`${HACKER_NEWS_API}${path}`);

  if (!response.ok) {
    throw new Error(`Hacker News answered ${response.status}`);
  }

  return response.json();
}

export function describeHackerNewsStory(story: HackerNewsStory): string {
  const url = story.url ?? `https://news.ycombinator.com/item?id=${story.id}`;
  const detail = [
    story.score !== undefined ? `${story.score} points` : "",
    story.descendants !== undefined ? `${story.descendants} comments` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return `${story.title} (${url})${detail ? ` · ${detail}` : ""}`;
}

export function hackerNewsFeedItem(story: HackerNewsStory) {
  return {
    title: story.title,
    url: story.url ?? `https://news.ycombinator.com/item?id=${story.id}`,
    snippet: "",
    source: [
      "Hacker News",
      story.score !== undefined ? `${story.score} points` : "",
      story.descendants !== undefined ? `${story.descendants} comments` : "",
    ]
      .filter(Boolean)
      .join(", "),
  };
}

export async function readHackerNewsFront(limit = FRONT_PAGE_LIMIT): Promise<HackerNewsStory[]> {
  const ids = storyIdsSchema.parse(await readJson("/topstories.json")).slice(0, limit);
  const stories = await Promise.all(
    ids.map(async (id) => storySchema.safeParse(await readJson(`/item/${id}.json`))),
  );

  return stories.flatMap((story) => (story.success ? [story.data] : []));
}
