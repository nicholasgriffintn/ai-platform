import type { KVNamespace } from "@cloudflare/workers-types";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { fetchSyndicationFeed } from "@ngriffin_uk/polychat-utility-server/feeds";
import { z } from "zod/v4";

import { KVCache } from "~/infrastructure/cache";
import type {
  DiscoverNewsCategory,
  DiscoverNewsItem,
} from "~/modules/discover/domain/news-categories";

const logger = getLogger({ prefix: "discover/news" });
const NEWS_FEED_CONCURRENCY = 4;
const NEWS_FEED_BYTES = 3_000_000;
const NEWS_ITEMS_PER_FEED = 20;
const NEWS_SNIPPET_LENGTH = 300;

export const discoverNewsItemsSchema = z.array(
  z.object({
    title: z.string(),
    url: z.string(),
    snippet: z.string(),
    source: z.string().optional(),
    date: z.string().optional(),
    category: z.string(),
    publishedAt: z.string(),
    observedAt: z.string().optional(),
    image: z.string().optional(),
  }),
);

export async function readDiscoverNews(
  categories: readonly DiscoverNewsCategory[],
  cacheBinding?: KVNamespace,
): Promise<DiscoverNewsItem[]> {
  const cache = cacheBinding ? new KVCache(cacheBinding, 900) : null;
  const feeds = categories.flatMap((category) =>
    category.feeds.map((feed) => ({ ...feed, category: category.id })),
  );
  const read = await mapWithConcurrency(feeds, NEWS_FEED_CONCURRENCY, async (feed) => {
    try {
      const cacheKey = `discover:public-news:${await sha256Hex(feed.url)}`;
      const cached = discoverNewsItemsSchema.safeParse(await cache?.get<unknown>(cacheKey));

      if (cached.success) {
        return cached.data;
      }

      const parsed = await fetchSyndicationFeed(feed.url, NEWS_FEED_BYTES);
      const observedAt = new Date().toISOString();

      const items = parsed.items.slice(0, NEWS_ITEMS_PER_FEED).flatMap((item) =>
        item.publishedAt
          ? [
              {
                title: item.title,
                url: item.url,
                snippet: item.summary.slice(0, NEWS_SNIPPET_LENGTH),
                source: feed.name,
                date: item.publishedAt.slice(0, 10),
                category: feed.category,
                publishedAt: item.publishedAt,
                observedAt,
                ...(item.imageUrl ? { image: item.imageUrl } : {}),
              },
            ]
          : [],
      );

      await cache?.set(cacheKey, items, { ttl: 900 });

      return items;
    } catch (error) {
      logger.warn("A Discover news feed could not be read", {
        feed: feed.name,
        category: feed.category,
        error_message: getErrorMessage(error),
      });

      return [];
    }
  });

  return read.flat();
}
