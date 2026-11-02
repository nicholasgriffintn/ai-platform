import {
  DISCOVER_EDITION_VERSION,
  DISCOVER_LIVE_CARD_KINDS,
  type DiscoverEdition,
  type DiscoverFeedItem,
  type DiscoverResponse,
  type DiscoverBriefLine,
} from "@ngriffin_uk/polychat-schemas";
import { normaliseComparableText } from "@ngriffin_uk/polychat-utility-core";

export function discoverFeedEdition(
  response: DiscoverResponse | undefined,
  items: readonly DiscoverFeedItem[],
): DiscoverEdition | null {
  const first = items[0];
  const day = response?.now?.context;
  const id = first?.editionId ?? (response?.feed?.updatedAt ? response.edition?.id : undefined);
  const generatedAt =
    response?.feed?.updatedAt ?? first?.observedAt ?? response?.edition?.generatedAt;

  if (!id || !day || !generatedAt) {
    return null;
  }

  const muted = new Set(response.dayProfile?.mutedTopics.map(normaliseComparableText));
  const curated = (response.edition?.cards ?? []).filter(
    (card) =>
      !DISCOVER_LIVE_CARD_KINDS.includes(card.kind) &&
      !("topic" in card && muted.has(normaliseComparableText(card.topic))),
  );

  return {
    version: DISCOVER_EDITION_VERSION,
    id,
    date: day.date,
    timezone: day.timezone,
    greeting: response.now?.title ?? "Discover",
    interests: response.edition?.interests ?? [],
    brief: discoverCurrentBrief(response, response.edition?.brief),
    cards: [...curated, ...items.map((item) => item.card)],
    feedback: {
      ...response.edition?.feedback,
      ...Object.fromEntries(items.map((item) => [item.card.id, item.signals])),
    },
    generatedAt,
    revision: 0,
  };
}

export function discoverCurrentBrief(
  response: DiscoverResponse | undefined,
  fallback: readonly DiscoverBriefLine[] = [],
): DiscoverBriefLine[] {
  const observations = response?.settings.enabled
    ? (response.now?.observations.slice(0, 4) ?? [])
    : [];

  if (observations.length === 0) {
    return [...fallback];
  }

  return observations.map((observation) => ({
    kind:
      observation.kind === "weather"
        ? "weather"
        : observation.kind === "calendar"
          ? "calendar"
          : observation.kind === "priority"
            ? "waiting"
            : "note",
    label: observation.stale ? `${observation.title} · Last known` : observation.title,
    text: observation.text,
    href: observation.href,
  }));
}

export function discoverMediaEdition(
  response: DiscoverResponse | undefined,
  items: readonly DiscoverFeedItem[],
  selectedBriefingId: string | null,
): DiscoverEdition | null {
  const edition = response?.edition ?? discoverFeedEdition(response, items);

  if (!edition) {
    return null;
  }

  const releases = response?.briefings ?? [];
  const release =
    releases.find((candidate) => candidate.id === selectedBriefingId) ??
    releases.find(
      (candidate) =>
        candidate.date === response?.now?.context.date &&
        candidate.sourceId &&
        candidate.status !== "failed",
    );

  return release?.sourceId ? { ...edition, listenSourceId: release.sourceId } : edition;
}
