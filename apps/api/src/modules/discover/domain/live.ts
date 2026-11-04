import {
  toListPage,
  DISCOVER_LIVE_LIMIT,
  discoverFeedItemSchema,
  discoverObservationSchema,
  type DiscoverCard,
  type DiscoverDayContext,
  type DiscoverFeedPage,
  type DiscoverNow,
  type DiscoverObservation,
  type DiscoverSettings,
  type DiscoverFeedbackSignal,
} from "@ngriffin_uk/polychat-schemas";
import {
  comparableHeadline,
  comparableHttpUrl,
  normaliseComparableText,
  describeZonedInstant,
} from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

import { discoverTravelWindow } from "./day";
import { discoverCardUrl, describeDiscoverCard } from "./edition";

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

export function emptyDiscoverLive(): DiscoverLiveContent {
  return {
    version: 1,
    profileRevision: 0,
    sequence: 0,
    checkedAt: null,
    updatedAt: null,
    observations: [],
    items: [],
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

export function mergeDiscoverLiveItems(
  current: DiscoverLiveContent,
  candidates: readonly DiscoverLiveCandidate[],
  now: Date,
): Pick<DiscoverLiveContent, "items" | "sequence" | "updatedAt"> {
  const instant = now.toISOString();
  const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const items = new Map(
    current.items.filter((item) => item.expiresAt > instant).map((item) => [item.id, item]),
  );
  const headlines = new Map(
    [...items.values()].map((item) => [
      comparableHeadline(describeDiscoverCard(item.card)),
      item.id,
    ]),
  );
  let sequence = current.sequence;

  for (const candidate of [...candidates].reverse()) {
    const evidenceAt = Date.parse(candidate.publishedAt ?? candidate.observedAt);

    if (
      !Number.isFinite(evidenceAt) ||
      evidenceAt > now.getTime() + 5 * 60 * 1000 ||
      now.getTime() - evidenceAt > 3 * 24 * 60 * 60 * 1000
    ) {
      continue;
    }

    const previous = items.get(candidate.id);
    const headline = comparableHeadline(describeDiscoverCard(candidate.card));
    const duplicateId = headlines.get(headline);

    if (!previous && headline.length >= 12 && duplicateId && duplicateId !== candidate.id) {
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

    sequence += 1;
    items.set(candidate.id, {
      ...candidate,
      revision: (previous?.revision ?? 0) + 1,
      sequence,
      firstShownAt: previous?.firstShownAt ?? instant,
      updatedAt: instant,
      expiresAt,
      seen: false,
      dismissed: false,
      signals: [],
    });
    headlines.set(headline, candidate.id);
  }

  return {
    sequence,
    updatedAt: sequence === current.sequence ? current.updatedAt : instant,
    items: [...items.values()]
      .sort((left, right) => right.sequence - left.sequence)
      .slice(0, DISCOVER_LIVE_LIMIT),
  };
}

export function listDiscoverFeedProviders(sources: DiscoverSettings["sources"]): Set<string> {
  return new Set(
    sources.filter((source) => source.connected && source.used).map((source) => source.providerId),
  );
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
  const before = input.after ? Number(input.after) : Number.POSITIVE_INFINITY;
  const page = available.filter((item) => item.sequence < before);
  const items = page.slice(0, input.limit + 1).map(({ fingerprint: _fingerprint, ...item }) => ({
    ...item,
    seen: (input.seen.get(item.id) ?? 0) >= item.revision,
    signals: input.feedback?.[item.card.id] ?? [],
  }));

  return {
    ...toListPage(items, input.limit, (item) => String(item.sequence)),
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
