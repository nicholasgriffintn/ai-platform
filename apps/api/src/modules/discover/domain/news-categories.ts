import { normaliseComparableText } from "@ngriffin_uk/polychat-utility-core";

import { discoverTopicKey } from "./edition";
import type { DiscoverResearchResult } from "./research";

export interface DiscoverNewsFeed {
  name: string;
  url: string;
}

export interface DiscoverNewsCategory {
  id: string;
  label: string;
  topic: string;
  feeds: readonly DiscoverNewsFeed[];
}

export interface DiscoverNewsItem extends DiscoverResearchResult {
  category: string;
  publishedAt: string;
}

const TOPIC_WORD_MIN_LENGTH = 2;

export const DISCOVER_NEWS_CATEGORIES: readonly DiscoverNewsCategory[] = [
  {
    id: "world",
    label: "World",
    topic: "World news",
    feeds: [
      { name: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
      { name: "The Guardian", url: "https://www.theguardian.com/world/rss" },
      { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
      { name: "NPR", url: "https://feeds.npr.org/1004/rss.xml" },
    ],
  },
  {
    id: "uk",
    label: "UK",
    topic: "UK news",
    feeds: [
      { name: "BBC News", url: "https://feeds.bbci.co.uk/news/uk/rss.xml" },
      { name: "The Guardian", url: "https://www.theguardian.com/uk-news/rss" },
      { name: "Sky News", url: "https://feeds.skynews.com/feeds/rss/uk.xml" },
    ],
  },
  {
    id: "us",
    label: "US",
    topic: "US news",
    feeds: [
      { name: "NPR", url: "https://feeds.npr.org/1001/rss.xml" },
      { name: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/US.xml" },
      { name: "PBS News", url: "https://www.pbs.org/newshour/feeds/rss/headlines" },
    ],
  },
  {
    id: "business",
    label: "Business",
    topic: "Business news",
    feeds: [
      { name: "BBC News", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
      { name: "The Guardian", url: "https://www.theguardian.com/business/rss" },
      { name: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
    ],
  },
  {
    id: "technology",
    label: "Technology",
    topic: "Technology news",
    feeds: [
      { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
      { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
      { name: "BBC News", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
      { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
    ],
  },
  {
    id: "ai",
    label: "AI",
    topic: "AI news",
    feeds: [
      {
        name: "MIT Technology Review",
        url: "https://www.technologyreview.com/topic/artificial-intelligence/feed",
      },
      {
        name: "The Verge",
        url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
      },
    ],
  },
  {
    id: "science",
    label: "Science",
    topic: "Science news",
    feeds: [
      { name: "BBC News", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml" },
      { name: "Science News", url: "https://www.sciencenews.org/feed" },
      { name: "Quanta Magazine", url: "https://www.quantamagazine.org/feed/" },
      { name: "Nature", url: "https://www.nature.com/nature.rss" },
    ],
  },
  {
    id: "climate",
    label: "Climate",
    topic: "Climate news",
    feeds: [
      { name: "The Guardian", url: "https://www.theguardian.com/environment/rss" },
      { name: "Carbon Brief", url: "https://www.carbonbrief.org/feed/" },
    ],
  },
  {
    id: "health",
    label: "Health",
    topic: "Health news",
    feeds: [
      { name: "BBC News", url: "https://feeds.bbci.co.uk/news/health/rss.xml" },
      { name: "STAT", url: "https://www.statnews.com/feed/" },
    ],
  },
  {
    id: "sport",
    label: "Sport",
    topic: "Sport news",
    feeds: [
      { name: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml" },
      { name: "The Guardian", url: "https://www.theguardian.com/uk/sport/rss" },
      { name: "ESPN", url: "https://www.espn.com/espn/rss/news" },
    ],
  },
  {
    id: "culture",
    label: "Culture",
    topic: "Culture news",
    feeds: [
      { name: "The Guardian", url: "https://www.theguardian.com/uk/culture/rss" },
      { name: "BBC News", url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml" },
      { name: "Pitchfork", url: "https://pitchfork.com/feed/feed-news/rss" },
    ],
  },
  {
    id: "gaming",
    label: "Gaming",
    topic: "Gaming news",
    feeds: [
      { name: "Eurogamer", url: "https://www.eurogamer.net/feed" },
      { name: "Polygon", url: "https://www.polygon.com/rss/index.xml" },
      { name: "Rock Paper Shotgun", url: "https://www.rockpapershotgun.com/feed" },
    ],
  },
];

const NEWS_TOPICS = new Set(
  DISCOVER_NEWS_CATEGORIES.map((category) => discoverTopicKey(category.topic)),
);

export function selectDiscoverNewsCategories(ids: readonly string[]): DiscoverNewsCategory[] {
  return DISCOVER_NEWS_CATEGORIES.filter((category) => ids.includes(category.id));
}

export function isDiscoverNewsTopic(topic: string): boolean {
  return NEWS_TOPICS.has(discoverTopicKey(topic));
}

function newestFirst(items: readonly DiscoverNewsItem[], since: string): DiscoverNewsItem[] {
  return items
    .filter((item) => item.publishedAt >= since)
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
}

function withoutCategory({
  category: _category,
  publishedAt: _publishedAt,
  ...item
}: DiscoverNewsItem) {
  return item;
}

export function pickDiscoverHeadlines(
  items: readonly DiscoverNewsItem[],
  input: { since: string; limit: number },
): DiscoverResearchResult[] {
  const queues = new Map<string, DiscoverNewsItem[]>();

  for (const item of newestFirst(items, input.since)) {
    queues.set(item.category, [...(queues.get(item.category) ?? []), item]);
  }

  const picked: DiscoverResearchResult[] = [];

  while (picked.length < input.limit && [...queues.values()].some((queue) => queue.length > 0)) {
    for (const queue of queues.values()) {
      const next = queue.shift();

      if (next && picked.length < input.limit) {
        picked.push(withoutCategory(next));
      }
    }
  }

  return picked;
}

export function listDiscoverCategoryNews(
  items: readonly DiscoverNewsItem[],
  input: { category: string; since: string; limit: number },
): DiscoverResearchResult[] {
  return newestFirst(
    items.filter((item) => item.category === input.category),
    input.since,
  )
    .slice(0, input.limit)
    .map(withoutCategory);
}

function topicWords(topic: string): string[] {
  return normaliseComparableText(topic)
    .split(" ")
    .filter((word) => word.length >= TOPIC_WORD_MIN_LENGTH);
}

export function matchDiscoverNews(
  topic: string,
  items: readonly DiscoverNewsItem[],
  input: { since: string; limit: number },
): DiscoverResearchResult[] {
  const words = topicWords(topic);

  if (words.length === 0) {
    return [];
  }

  return newestFirst(items, input.since)
    .filter((item) => {
      const text = ` ${normaliseComparableText(`${item.title} ${item.snippet}`)} `;

      return words.every((word) => text.includes(` ${word} `));
    })
    .slice(0, input.limit)
    .map(withoutCategory);
}
