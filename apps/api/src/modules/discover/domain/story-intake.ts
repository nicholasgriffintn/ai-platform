import { storyIntakeArticleSchema, type StoryIntakeArticle } from "@ngriffin_uk/polychat-schemas";
import {
  comparableHttpUrl,
  readUrlHost,
  truncateSingleLine,
} from "@ngriffin_uk/polychat-utility-core";

import { DISCOVER_NEWS_CATEGORIES, type DiscoverNewsItem } from "./news-categories";

export function listStoryIntakeArticles(news: readonly DiscoverNewsItem[]): StoryIntakeArticle[] {
  const seen = new Set<string>();

  return news.flatMap((item) => {
    const url = comparableHttpUrl(item.url);
    const topic = DISCOVER_NEWS_CATEGORIES.find((category) => category.id === item.category)?.topic;

    if (!url || !topic || seen.has(url)) {
      return [];
    }

    seen.add(url);

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
