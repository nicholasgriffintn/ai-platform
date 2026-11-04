import {
  DISCOVER_LIVE_CARD_KINDS,
  type DiscoverDayProfile,
  type DiscoverCard,
} from "@ngriffin_uk/polychat-schemas";
import {
  comparableHttpUrl,
  describeZonedInstant,
  generateId,
  sha256Hex,
} from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { attachDiscoverArticles } from "~/modules/discover/domain/articles";
import { resolveDiscoverDay } from "~/modules/discover/domain/day";
import { rankDiscoverDayCards } from "~/modules/discover/domain/day-ranking";
import { discoverTopicKey } from "~/modules/discover/domain/edition";
import {
  buildDiscoverFeedGroups,
  fillDiscoverLiveFeed,
  splitDiscoverSignalFeeds,
} from "~/modules/discover/domain/feed";
import { summariseDiscoverFeedPreferences } from "~/modules/discover/domain/feed-weights";
import { summariseDiscoverFeedback } from "~/modules/discover/domain/feedback";
import { collectSeenLinks } from "~/modules/discover/domain/links";
import {
  DISCOVER_LIVE_FRESH_MS,
  discoverCardIdentity,
  discoverCardMaterial,
  type DiscoverLiveCandidate,
} from "~/modules/discover/domain/live";
import {
  DISCOVER_NEWS_CATEGORIES,
  listDiscoverCategoryNews,
  type DiscoverNewsItem,
} from "~/modules/discover/domain/news-categories";
import {
  DISCOVER_HEADLINES_TOPIC,
  keepRecentDiscoverResults,
  selectCurrentResearch,
} from "~/modules/discover/domain/research";
import { findDiscoverSignal } from "~/modules/discover/domain/signal-catalogue";
import { keepUsedDiscoverDocuments } from "~/modules/discover/domain/signal-selection";

import { listDiscoverArticleSources } from "./articles";
import { listRecentDiscoverEditions } from "./editions";
import { listDiscoverFeedback } from "./feedback";
import { listDiscoverFollows } from "./follows";
import { resolveDiscoverSignals } from "./gather";
import { discoverLiveId } from "./live-store";
import { listDiscoverDocuments } from "./notebook";
import type { DiscoverRoutineSettings } from "./settings";

const LIVE_CARD_LIMIT = 80;
const LIVE_NEWS_SLOTS = 24;

export async function collectDiscoverLiveCandidates(
  context: ServiceContext,
  profile: DiscoverDayProfile,
  settings: DiscoverRoutineSettings,
  news: readonly DiscoverNewsItem[],
  now: Date,
): Promise<DiscoverLiveCandidate[]> {
  const user = context.requireUser();
  const [documents, editions, feedback, follows, articleSources] = await Promise.all([
    listDiscoverDocuments(context, user.id),
    listRecentDiscoverEditions(context, user.id, 2),
    listDiscoverFeedback(context, user.id),
    listDiscoverFollows(context, user.id),
    listDiscoverArticleSources(context),
  ]);
  const hidden = new Set(
    [...profile.mutedTopics, ...summariseDiscoverFeedback(feedback).hiddenTopics].map(
      discoverTopicKey,
    ),
  );
  const { selected } = await resolveDiscoverSignals(context, settings);
  const { browsed, shared } = splitDiscoverSignalFeeds(
    keepUsedDiscoverDocuments(documents.signals, {
      selected,
      excludedProviders: settings.excludedProviders,
    }),
  );
  const today = describeZonedInstant(now, profile.timezone).date;
  const research = keepRecentDiscoverResults(
    selectCurrentResearch(documents.research, { today, hiddenTopics: hidden }),
    today,
  );
  const freshSince = new Date(now.getTime() - DISCOVER_LIVE_FRESH_MS).toISOString();
  const liveNews = DISCOVER_NEWS_CATEGORIES.map((category) => ({
    topic: category.topic,
    results: listDiscoverCategoryNews(news, {
      category: category.id,
      since: freshSince,
      limit: LIVE_CARD_LIMIT,
    }),
  })).filter((document) => document.results.length > 0);
  const liveTopics = new Set(liveNews.map((document) => document.topic));
  const explicitTopics = new Set(
    [...profile.topics, ...follows.map((follow) => follow.topic)].map(discoverTopicKey),
  );
  const groups = buildDiscoverFeedGroups({
    research: [...research.filter((document) => !liveTopics.has(document.topic)), ...liveNews],
    signals: shared.map((signal) => ({ title: signal.title, items: signal.items })),
    headlinesTopic: DISCOVER_HEADLINES_TOPIC,
    followedTopics: explicitTopics,
    curate: settings.curate,
    interestOrder: [
      ...profile.topics,
      ...(editions[0]?.content.interests.map((interest) => interest.topic) ?? []),
    ],
    preferences: summariseDiscoverFeedPreferences(feedback),
  });
  const cards = fillDiscoverLiveFeed({
    groups,
    seen: collectSeenLinks(browsed.flatMap((signal) => signal.items)),
    skipTopics: hidden,
    limit: LIVE_CARD_LIMIT,
    newsSlots: LIVE_NEWS_SLOTS,
    createId: generateId,
  });
  const chosen: Array<{ card: DiscoverCard; editionId: string }> = [
    ...cards.map((card) => ({ card, editionId: discoverLiveId(user.id) })),
    ...editions.flatMap((edition) =>
      edition.content.cards
        .filter(
          (card) =>
            DISCOVER_LIVE_CARD_KINDS.includes(card.kind) &&
            !("topic" in card && hidden.has(discoverTopicKey(card.topic))),
        )
        .map((card) => ({ card, editionId: edition.id })),
    ),
  ];
  const metadata = new Map(
    news.flatMap((item) => {
      const url = comparableHttpUrl(item.url);

      return url ? [[url, item] as const] : [];
    }),
  );
  const seen = new Set<string>();
  const observed = new Map<string, string>();
  const providers = new Map<string, string>();

  for (const document of research) {
    const readAt = documents.research.find((source) => source.topic === document.topic)?.readAt;

    if (readAt) {
      for (const result of document.results) {
        observed.set(comparableHttpUrl(result.url) ?? result.url, readAt);
      }
    }
  }

  for (const document of shared) {
    if (document.readAt) {
      for (const result of document.items) {
        observed.set(comparableHttpUrl(result.url) ?? result.url, document.readAt);
        const provider = findDiscoverSignal(document.signalId)?.providerId;

        if (provider) {
          providers.set(comparableHttpUrl(result.url) ?? result.url, provider);
        }
      }
    }
  }

  const candidates: DiscoverLiveCandidate[] = [];

  const saved = new Set(
    feedback
      .filter((item) => item.signal === "saved" && item.url)
      .map((item) => comparableHttpUrl(item.url ?? "") ?? ""),
  );
  const work = new Set(
    documents.signals
      .filter((signal) => findDiscoverSignal(signal.signalId)?.group === "work")
      .flatMap((signal) => signal.items.map((item) => comparableHttpUrl(item.url) ?? item.url)),
  );
  const ranked = rankDiscoverDayCards(chosen, {
    day: resolveDiscoverDay(profile, now),
    topics: explicitTopics,
    saved,
    work,
  });

  for (const { card, editionId } of ranked) {
    const key = discoverCardIdentity(card);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    const id = `discover_item_${(await sha256Hex(`${user.id}:${key}`)).slice(0, 32)}`;
    const source = metadata.get(key);
    const publishedAt =
      source?.publishedAt && Number.isFinite(Date.parse(source.publishedAt))
        ? new Date(source.publishedAt).toISOString()
        : null;
    const attached = attachDiscoverArticles([card], articleSources)[0] ?? card;

    const observedAt =
      source?.observedAt ??
      observed.get(key) ??
      editions.find((edition) => edition.id === editionId)?.content.generatedAt;

    if (!observedAt) {
      continue;
    }

    candidates.push({
      id,
      fingerprint: await sha256Hex(discoverCardMaterial(card)),
      card: { ...attached, id },
      editionId: discoverLiveId(user.id),
      providerId: providers.get(key),
      publishedAt,
      observedAt,
    });
  }

  return candidates;
}
