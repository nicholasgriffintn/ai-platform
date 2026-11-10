import {
  toListPage,
  DISCOVER_ALSO_IN_LIMIT,
  DISCOVER_LIVE_LIMIT,
  discoverSourceOutlet,
  discoverFeedItemSchema,
  discoverDeviceLocationSchema,
  discoverObservationSchema,
  type DiscoverCard,
  type DiscoverDayContext,
  type DiscoverFeedItem,
  type DiscoverFeedPage,
  type DiscoverNow,
  type DiscoverObservation,
  type DiscoverSettings,
  type DiscoverFeedbackSignal,
} from "@ngriffin_uk/polychat-schemas";
import {
  comparableHeadline,
  comparableHttpUrl,
  headlineTerms,
  isSameStory,
  normaliseComparableText,
  describeZonedInstant,
} from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

import { discoverTravelWindow } from "./day";
import { discoverCardUrl, describeDiscoverCard } from "./edition";

export const DISCOVER_LIVE_FRESH_MS = 24 * 60 * 60 * 1000;
const DISCOVER_LIVE_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;
const DISCOVER_FEED_SHELF_KINDS: ReadonlySet<DiscoverCard["kind"]> = new Set([
  "topic",
  "wind_down",
  "watch",
  "listen",
]);
const DISCOVER_FEED_SHELF_LIMIT = 12;
const DISCOVER_LIVE_RETIRED_LIMIT = 1_000;
const DISCOVER_LIVE_RETIRED_KEY_LENGTH = 16;
const DISCOVER_HEADLINE_MIN_LENGTH = 12;
const DISCOVER_IMAGE_TYPE = /^image\/(?:avif|gif|jpeg|png|webp)\b/iu;

export const discoverLiveContentSchema = z
  .object({
    version: z.literal(1),
    profileRevision: z.number().int().nonnegative(),
    sequence: z.number().int().nonnegative(),
    checkedAt: z.iso.datetime().nullable(),
    updatedAt: z.iso.datetime().nullable(),
    observations: z.array(discoverObservationSchema).max(16),
    items: z
      .array(discoverFeedItemSchema.extend({ fingerprint: z.string().min(1) }))
      .max(DISCOVER_LIVE_LIMIT),
    retired: z.array(z.string()).max(DISCOVER_LIVE_RETIRED_LIMIT).default([]),
    deviceLocation: discoverDeviceLocationSchema
      .extend({ observedAt: z.iso.datetime(), expiresAt: z.iso.datetime() })
      .nullable()
      .default(null),
    nearbyLines: discoverDeviceLocationSchema
      .extend({ lines: z.array(z.string().min(1).max(60)).max(40), checkedAt: z.iso.datetime() })
      .nullable()
      .default(null),
  })
  .strict();

export type DiscoverLiveContent = z.infer<typeof discoverLiveContentSchema>;
export type DiscoverLiveItem = DiscoverLiveContent["items"][number];

export interface DiscoverLiveCandidate {
  id: string;
  fingerprint: string;
  card: DiscoverCard;
  editionId: string;
  providerId?: string;
  publishedAt: string | null;
  observedAt: string;
}

export function isDiscoverImageType(contentType: string): boolean {
  return DISCOVER_IMAGE_TYPE.test(contentType);
}

export function emptyDiscoverLive(): DiscoverLiveContent {
  return {
    version: 1,
    profileRevision: 0,
    sequence: 0,
    checkedAt: null,
    updatedAt: null,
    observations: [],
    items: [],
    retired: [],
    deviceLocation: null,
    nearbyLines: null,
  };
}

export function discoverCardIdentity(card: DiscoverCard): string {
  const url = discoverCardUrl(card);

  return url
    ? (comparableHttpUrl(url) ?? url)
    : `${card.kind}:${normaliseComparableText(describeDiscoverCard(card))}`;
}

export function discoverCardMaterial(card: DiscoverCard): string {
  return JSON.stringify({
    kind: card.kind,
    title: describeDiscoverCard(card),
    content:
      "summary" in card
        ? card.summary
        : "angle" in card
          ? card.angle
          : "detail" in card
            ? card.detail
            : "",
    when: "when" in card ? card.when : "",
  });
}

function retiredKey(id: string): string {
  return id.slice(-DISCOVER_LIVE_RETIRED_KEY_LENGTH);
}

interface DiscoverStoryIndexEntry {
  id: string;
  headline: string;
  terms: ReadonlySet<string>;
  outlet: string | null;
  storyId: string | null;
}

function indexDiscoverStory(id: string, card: DiscoverCard): DiscoverStoryIndexEntry {
  const title = describeDiscoverCard(card);

  return {
    id,
    headline: comparableHeadline(title),
    terms: headlineTerms(title),
    outlet: "source" in card ? discoverSourceOutlet(card.source) : null,
    storyId: card.kind === "read" ? (card.storyId ?? null) : null,
  };
}

function findRepeatedDiscoverStory(
  candidate: DiscoverStoryIndexEntry,
  stories: readonly DiscoverStoryIndexEntry[],
): DiscoverStoryIndexEntry | undefined {
  return stories.find(
    (story) =>
      story.id !== candidate.id &&
      ((story.storyId !== null && story.storyId === candidate.storyId) ||
        (candidate.headline.length >= DISCOVER_HEADLINE_MIN_LENGTH &&
          story.headline === candidate.headline) ||
        (story.outlet !== null &&
          candidate.outlet !== null &&
          story.outlet !== candidate.outlet &&
          isSameStory(story.terms, candidate.terms))),
  );
}

function addDiscoverCoverage(item: DiscoverLiveItem, repeat: DiscoverCard): DiscoverLiveItem {
  if (item.card.kind !== "read" || repeat.kind !== "read") {
    return item;
  }

  const source = discoverSourceOutlet(repeat.source);
  const alsoIn = item.card.alsoIn ?? [];

  return source === discoverSourceOutlet(item.card.source) ||
    alsoIn.some((outlet) => outlet.source === source) ||
    alsoIn.length >= DISCOVER_ALSO_IN_LIMIT
    ? item
    : { ...item, card: { ...item.card, alsoIn: [...alsoIn, { source, url: repeat.url }] } };
}

function isDiscoverRewording(previous: DiscoverCard, next: DiscoverCard): boolean {
  const before = describeDiscoverCard(previous);
  const after = describeDiscoverCard(next);

  return before === after || isSameStory(headlineTerms(before), headlineTerms(after));
}

export function mergeDiscoverLiveItems(
  current: DiscoverLiveContent,
  candidates: readonly DiscoverLiveCandidate[],
  now: Date,
): Pick<DiscoverLiveContent, "items" | "sequence" | "updatedAt" | "retired"> {
  const instant = now.toISOString();
  const items = new Map(
    current.items.filter((item) => item.expiresAt > instant).map((item) => [item.id, item]),
  );
  const retired = new Set(current.retired);
  const stories = [...items.values()].map((item) => indexDiscoverStory(item.id, item.card));
  let sequence = current.sequence;

  for (const candidate of [...candidates].reverse()) {
    const evidenceAt = Date.parse(candidate.publishedAt ?? candidate.observedAt);

    if (
      !Number.isFinite(evidenceAt) ||
      evidenceAt > now.getTime() + 5 * 60 * 1000 ||
      now.getTime() - evidenceAt > DISCOVER_LIVE_RETENTION_MS
    ) {
      continue;
    }

    const previous = items.get(candidate.id);
    const story = indexDiscoverStory(candidate.id, candidate.card);

    if (!previous && retired.has(retiredKey(candidate.id))) {
      continue;
    }

    const repeated = previous ? undefined : findRepeatedDiscoverStory(story, stories);

    if (repeated) {
      const original = items.get(repeated.id);

      if (original) {
        items.set(repeated.id, addDiscoverCoverage(original, candidate.card));
      }

      continue;
    }

    if (previous?.fingerprint === candidate.fingerprint) {
      items.set(candidate.id, {
        ...previous,
        card: { ...previous.card, ...candidate.card },
        observedAt: candidate.observedAt,
        providerId: candidate.providerId,
      });
      continue;
    }

    if (previous?.dismissed) {
      continue;
    }

    if (previous && isDiscoverRewording(previous.card, candidate.card)) {
      items.set(candidate.id, {
        ...previous,
        card: { ...previous.card, ...candidate.card },
        fingerprint: candidate.fingerprint,
        observedAt: candidate.observedAt,
        providerId: candidate.providerId,
      });
      continue;
    }

    if (now.getTime() - evidenceAt > DISCOVER_LIVE_FRESH_MS) {
      continue;
    }

    sequence += 1;
    items.set(candidate.id, {
      ...candidate,
      revision: (previous?.revision ?? 0) + 1,
      sequence,
      firstShownAt: previous?.firstShownAt ?? instant,
      updatedAt: instant,
      expiresAt: new Date(evidenceAt + DISCOVER_LIVE_RETENTION_MS).toISOString(),
      seen: false,
      dismissed: false,
      signals: [],
    });
    stories.push(story);
  }

  const ordered = [...items.values()].sort((left, right) => right.sequence - left.sequence);
  const kept = ordered.slice(0, DISCOVER_LIVE_LIMIT);
  const keptIds = new Set(kept.map((item) => item.id));
  const left = [...current.items, ...ordered.slice(DISCOVER_LIVE_LIMIT)]
    .filter((item) => !keptIds.has(item.id))
    .map((item) => retiredKey(item.id));

  return {
    sequence,
    updatedAt: sequence === current.sequence ? current.updatedAt : instant,
    items: kept,
    retired: [...new Set([...left, ...current.retired])].slice(0, DISCOVER_LIVE_RETIRED_LIMIT),
  };
}

export function listDiscoverFeedProviders(sources: DiscoverSettings["sources"]): Set<string> {
  return new Set(
    sources.filter((source) => source.connected && source.used).map((source) => source.providerId),
  );
}

function rankDiscoverPage(
  items: readonly DiscoverFeedItem[],
  weighTopic: (topic: string) => number,
): DiscoverFeedItem[] {
  return items
    .map((item, index) => ({
      item,
      position: (index + 1) / ("topic" in item.card ? weighTopic(item.card.topic) : 1),
    }))
    .sort((left, right) => left.position - right.position)
    .map(({ item }) => item);
}

function selectDiscoverShelfItems(
  items: readonly DiscoverLiveItem[],
  limit: number,
  now: Date,
): DiscoverLiveItem[] {
  return items
    .filter(
      (item) =>
        DISCOVER_FEED_SHELF_KINDS.has(item.card.kind) &&
        now.getTime() - Date.parse(item.observedAt) <= DISCOVER_LIVE_FRESH_MS,
    )
    .slice(0, Math.min(DISCOVER_FEED_SHELF_LIMIT, Math.floor(limit / 2)));
}

export function presentDiscoverFeed(
  content: DiscoverLiveContent,
  input: {
    seen: ReadonlyMap<string, number>;
    mutedTopics: readonly string[];
    allowedProviders?: ReadonlySet<string>;
    feedback?: Readonly<Record<string, DiscoverFeedbackSignal[]>>;
    after?: string;
    limit: number;
    leadWithShelf?: boolean;
    weighTopic?: (topic: string) => number;
    now: Date;
  },
): DiscoverFeedPage {
  const muted = new Set(input.mutedTopics.map(normaliseComparableText));
  const available = content.items.filter(
    (item) =>
      !item.dismissed &&
      item.expiresAt > input.now.toISOString() &&
      (!item.providerId ||
        !input.allowedProviders ||
        input.allowedProviders.has(item.providerId)) &&
      !("topic" in item.card && muted.has(normaliseComparableText(item.card.topic))),
  );
  const unseenCount = available.filter(
    (item) => (input.seen.get(item.id) ?? 0) < item.revision,
  ).length;
  const shelf = input.leadWithShelf
    ? selectDiscoverShelfItems(available, input.limit, input.now)
    : [];
  const shelved = new Set(shelf.map((item) => item.id));
  const before = input.after ? Number(input.after) : Number.POSITIVE_INFINITY;
  const page = available.filter((item) => !shelved.has(item.id) && item.sequence < before);
  const lead = input.after ? [] : shelf;
  const items = [...lead, ...page.slice(0, input.limit + 1 - lead.length)].map(
    ({ fingerprint: _fingerprint, ...item }) => ({
      ...item,
      seen: (input.seen.get(item.id) ?? 0) >= item.revision,
      signals: input.feedback?.[item.card.id] ?? [],
    }),
  );

  const listed = toListPage(items, input.limit, (item) => String(item.sequence));

  return {
    ...listed,
    data: input.weighTopic
      ? [
          ...listed.data.slice(0, lead.length),
          ...rankDiscoverPage(listed.data.slice(lead.length), input.weighTopic),
        ]
      : listed.data,
    unseenCount,
    updatedAt: content.updatedAt,
  };
}

function discoverObservationRank(observation: DiscoverObservation): number {
  if (observation.stale) {
    return 2;
  }

  return observation.kind === "travel" || observation.actionable ? 0 : 1;
}

export function presentDiscoverNow(
  content: DiscoverLiveContent,
  day: DiscoverDayContext,
  now: Date,
): DiscoverNow {
  const travel = discoverTravelWindow(day, now);
  const titles = {
    morning: "Your day ahead",
    lunch: "Your lunchtime catch-up",
    afternoon: day.mode === "office" ? "Before you head home" : "Your afternoon update",
    evening: "Your evening catch-up",
  };

  return {
    context: day,
    title: titles[day.moment],
    observations: content.observations
      .filter(
        (observation) =>
          observation.kind !== "travel" ||
          (travel !== null && observation.id === `travel:${day.date}:${travel.direction}`),
      )
      .map((observation) => ({
        ...observation,
        stale:
          observation.stale ||
          observation.expiresAt <= now.toISOString() ||
          ((observation.kind === "calendar" || observation.kind === "task") &&
            describeZonedInstant(new Date(observation.observedAt), day.timezone).date !== day.date),
      }))
      .sort((left, right) => discoverObservationRank(left) - discoverObservationRank(right)),
    checkedAt: content.checkedAt,
    updatedAt: content.updatedAt,
    nextRefreshAt: content.checkedAt
      ? new Date(Date.parse(content.checkedAt) + 15 * 60 * 1000).toISOString()
      : new Date(Math.floor(now.getTime() / (15 * 60 * 1000)) * 15 * 60 * 1000).toISOString(),
  };
}
