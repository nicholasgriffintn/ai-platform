import { KNOWLEDGE_FEED_METADATA_KEY, type KnowledgeFeed } from "@ngriffin_uk/polychat-schemas";
import { readUrlHost } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import {
  SyndicationFeedResponseError,
  fetchSyndicationFeed,
  type SyndicationFeed,
} from "@ngriffin_uk/polychat-utility-server/feeds";
import { UnsafeUrlError, parsePublicHttpUrl } from "@ngriffin_uk/polychat-utility-server/http";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { gatherKnowledgeArticles } from "~/modules/knowledge/application/intake/articles";
import { findTopicArticles } from "~/modules/knowledge/application/syncs/topics";
import type { KnowledgeArticleCandidate, KnowledgeTarget } from "~/modules/knowledge/domain/item";

const FEED_RESPONSE_BYTES = 5_000_000;
const FEED_ARTICLE_READ_LIMIT = 10;
const FEED_TOPIC_LIMIT = 10;
const FEED_TOPIC_DAYS = 2;

interface FeedCandidate extends KnowledgeArticleCandidate {
  publishedAt: string | null;
}

export function requirePublicFeedUrl(url: string): URL {
  try {
    return parsePublicHttpUrl(url);
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      throw new AssistantError("Use a public feed address", ErrorType.PARAMS_ERROR, 400);
    }

    throw error;
  }
}

async function readSyndicationFeed(url: string): Promise<SyndicationFeed> {
  try {
    return await fetchSyndicationFeed(requirePublicFeedUrl(url), FEED_RESPONSE_BYTES);
  } catch (error) {
    if (error instanceof SyndicationFeedResponseError) {
      throw new AssistantError(
        error.message,
        ErrorType.PROVIDER_ERROR,
        error.status === 404 || error.status === 410 ? 404 : 502,
      );
    }

    throw error;
  }
}

async function readSyndicationCandidates(url: string): Promise<FeedCandidate[]> {
  const feed = await readSyndicationFeed(url);
  const source = (feed.title || readUrlHost(url)).slice(0, 80);

  return feed.items.map((item) => ({
    title: item.title.slice(0, 200),
    url: item.url,
    snippet: item.summary,
    source,
    publishedAt: item.publishedAt,
    ...(item.publishedAt ? { date: item.publishedAt.slice(0, 10) } : {}),
  }));
}

async function readFeedCandidates(
  context: ServiceContext,
  target: KnowledgeTarget,
  feed: KnowledgeFeed,
): Promise<FeedCandidate[]> {
  if (feed.kind === "rss") {
    return readSyndicationCandidates(feed.url);
  }

  const found = await findTopicArticles(context, target, {
    kind: feed.kind,
    query: feed.query,
    days: FEED_TOPIC_DAYS,
    country: feed.kind === "news" ? (feed.country ?? null) : null,
    limit: FEED_TOPIC_LIMIT,
  });

  return found.map((candidate) => ({ ...candidate, publishedAt: candidate.date ?? null }));
}

export async function gatherFeed(
  context: ServiceContext,
  target: KnowledgeTarget,
  input: { syncId: string; feed: KnowledgeFeed },
): Promise<number> {
  const candidates = await readFeedCandidates(context, target, input.feed);
  const gatheredAt = new Date().toISOString();
  const publishedAt = new Map(
    candidates.map((candidate) => [candidate.url, candidate.publishedAt]),
  );
  const gathered = await gatherKnowledgeArticles(context, target, candidates, {
    origin: input.feed.kind === "rss" ? "feed" : "topic",
    readLimit: FEED_ARTICLE_READ_LIMIT,
    metadata: (candidate) => ({
      [KNOWLEDGE_FEED_METADATA_KEY]: {
        syncId: input.syncId,
        kind: input.feed.kind,
        publishedAt: publishedAt.get(candidate.url) ?? gatheredAt,
      },
    }),
  });

  return gathered.filter((article) => article.sourceId).length;
}
