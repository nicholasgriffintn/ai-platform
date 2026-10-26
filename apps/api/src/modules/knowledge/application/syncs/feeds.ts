import { KNOWLEDGE_FEED_METADATA_KEY, type KnowledgeFeed } from "@ngriffin_uk/polychat-schemas";
import { readUrlHost } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseSyndicationFeed } from "@ngriffin_uk/polychat-utility-server/feeds";
import {
  UnsafeUrlError,
  fetchFollowingSafeRedirects,
  parsePublicHttpUrl,
  readResponseTextWithinLimit,
} from "@ngriffin_uk/polychat-utility-server/http";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { gatherKnowledgeArticles } from "~/modules/knowledge/application/intake/articles";
import { findTopicArticles } from "~/modules/knowledge/application/syncs/topics";
import type { KnowledgeArticleCandidate, KnowledgeTarget } from "~/modules/knowledge/domain/item";

const FEED_RESPONSE_BYTES = 5_000_000;
const FEED_ARTICLE_READ_LIMIT = 10;
const FEED_TOPIC_LIMIT = 10;
const FEED_TOPIC_DAYS = 2;
const FEED_ACCEPT =
  "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5";

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

async function readSyndicationCandidates(url: string): Promise<FeedCandidate[]> {
  const response = await fetchFollowingSafeRedirects(requirePublicFeedUrl(url), {
    headers: { accept: FEED_ACCEPT },
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new AssistantError(
      `The feed answered with ${response.status}`,
      ErrorType.PROVIDER_ERROR,
      response.status === 404 || response.status === 410 ? 404 : 502,
    );
  }

  const feed = parseSyndicationFeed(
    await readResponseTextWithinLimit(response, FEED_RESPONSE_BYTES),
    response.url || url,
  );
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
    summarise: false,
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
