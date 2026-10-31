import { getFileTargetPath, getPlacePaths } from "@ngriffin_uk/polychat-library-react";
import type {
  DiscoverCard,
  DiscoverEdition,
  DiscoverSettings,
} from "@ngriffin_uk/polychat-schemas";

import type { DiscoverRowCard } from "../DiscoverFeedCard.js";
import type { DiscoverStoryCard } from "../DiscoverStoryTile.js";
import type { DiscoverMedia } from "../media/media-status.js";

export type DiscoverTopicCard = Extract<DiscoverCard, { kind: "topic" }>;

export type DiscoverItem =
  | { type: "media"; media: DiscoverMedia }
  | { type: "card"; card: DiscoverCard };

export interface DiscoverCardGroups {
  topics: DiscoverTopicCard[];
  stories: DiscoverStoryCard[];
  forYou: DiscoverRowCard[];
  comingUp: DiscoverRowCard[];
  reads: DiscoverRowCard[];
  watching: DiscoverRowCard[];
}

export function discoverItemKey(item: DiscoverItem): string {
  return item.type === "media" ? `media:${item.media}` : `card:${item.card.id}`;
}

export function discoverMediaShelf(
  edition: DiscoverEdition,
  settings: Pick<DiscoverSettings, "episode">,
): DiscoverMedia[] {
  return [
    ...(settings.episode !== "off" || edition.episodeId ? (["episode"] as const) : []),
    ...(edition.weekSourceId ? (["week"] as const) : []),
    "perch",
    "wind_down",
  ];
}

export function groupDiscoverCards(cards: readonly DiscoverCard[]): DiscoverCardGroups {
  const rows = cards.filter(
    (card): card is DiscoverRowCard => card.kind !== "topic" && card.kind !== "wind_down",
  );

  return {
    topics: cards.filter((card): card is DiscoverTopicCard => card.kind === "topic"),
    stories: cards.filter((card): card is DiscoverStoryCard => card.kind === "wind_down"),
    forYou: rows.filter(
      (card) => card.kind === "action" || card.kind === "check_in" || card.kind === "resurface",
    ),
    comingUp: rows.filter((card) => card.kind === "event"),
    reads: rows.filter((card) => card.kind === "read" || card.kind === "inbox"),
    watching: rows.filter((card) => card.kind === "watch" || card.kind === "listen"),
  };
}

export function orderDiscoverItems(
  media: readonly DiscoverMedia[],
  groups: DiscoverCardGroups,
): DiscoverItem[] {
  return [
    ...media.map((entry): DiscoverItem => ({ type: "media", media: entry })),
    ...[
      ...groups.topics,
      ...groups.forYou,
      ...groups.comingUp,
      ...groups.reads,
      ...groups.watching,
    ].map((card): DiscoverItem => ({ type: "card", card })),
  ];
}

export function stepDiscoverItem(
  items: readonly DiscoverItem[],
  current: DiscoverItem | null,
  direction: 1 | -1,
): DiscoverItem | null {
  if (items.length === 0) {
    return null;
  }

  const index = current
    ? items.findIndex((item) => discoverItemKey(item) === discoverItemKey(current))
    : -1;

  if (index === -1) {
    return items[direction === 1 ? 0 : items.length - 1] ?? null;
  }

  return items[(index + direction + items.length) % items.length] ?? null;
}

export function discoverItemFileHref(item: DiscoverItem, edition: DiscoverEdition): string | null {
  const files = getPlacePaths("chat").files;

  if (item.type === "card") {
    return item.card.kind === "read" && item.card.sourceId
      ? getFileTargetPath(files, { origin: "source", id: item.card.sourceId })
      : null;
  }

  switch (item.media) {
    case "episode":
      return edition.episodeId
        ? getFileTargetPath(files, { origin: "output", id: edition.episodeId })
        : null;
    case "perch":
      return edition.listenSourceId
        ? getFileTargetPath(files, { origin: "source", id: edition.listenSourceId })
        : null;
    case "week":
      return edition.weekSourceId
        ? getFileTargetPath(files, { origin: "source", id: edition.weekSourceId })
        : null;
    case "wind_down":
    case "story":
      return null;
  }
}
