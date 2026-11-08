import {
  DISCOVER_ALSO_IN_LIMIT,
  storyIntakeArticleSchema,
  type DiscoverCard,
  type StoryIntakeArticle,
} from "@ngriffin_uk/polychat-schemas";
import {
  comparableHttpUrl,
  readUrlHost,
  truncateSingleLine,
} from "@ngriffin_uk/polychat-utility-core";

import { DISCOVER_NEWS_CATEGORIES, type DiscoverNewsItem } from "./news-categories";

export function listStoryIntakeArticles(
  cards: readonly DiscoverCard[],
  news: readonly DiscoverNewsItem[],
): StoryIntakeArticle[] {
  const byUrl = new Map(
    news.flatMap((item) => {
      const url = comparableHttpUrl(item.url);

      return url ? [[url, item] as const] : [];
    }),
  );

  return cards.flatMap((card) => {
    const item = card.kind === "read" ? byUrl.get(comparableHttpUrl(card.url) ?? "") : undefined;
    const topic = DISCOVER_NEWS_CATEGORIES.find(
      (category) => category.id === item?.category,
    )?.topic;

    if (!item || !topic) {
      return [];
    }

    const parsed = storyIntakeArticleSchema.safeParse({
      url: item.url,
      headline: truncateSingleLine(item.title, 300),
      standfirst: truncateSingleLine(item.snippet, 600),
      outlet: truncateSingleLine(item.source || readUrlHost(item.url), 120),
      topic,
      publishedAt: new Date(item.publishedAt).toISOString(),
      ...(item.image ? { imageUrl: item.image } : {}),
    });

    return parsed.success ? [parsed.data] : [];
  });
}

type ReadCard = Extract<DiscoverCard, { kind: "read" }>;

export function foldIntoStoryCard(lead: ReadCard, card: ReadCard): ReadCard {
  const alsoIn = lead.alsoIn ?? [];

  if (
    alsoIn.length >= DISCOVER_ALSO_IN_LIMIT ||
    card.source === lead.source ||
    alsoIn.some((entry) => entry.url === card.url)
  ) {
    return lead;
  }

  return { ...lead, alsoIn: [...alsoIn, { source: card.source.slice(0, 80), url: card.url }] };
}
