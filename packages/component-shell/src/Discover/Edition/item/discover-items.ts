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

export type DiscoverEditionItem =
  | { type: "media"; media: DiscoverMedia }
  | { type: "card"; card: DiscoverCard };

export type DiscoverGraphItem =
  | { type: "story"; storyId: string }
  | { type: "entity"; entityId: string }
  | { type: "angles" };

export type DiscoverItem = DiscoverEditionItem | DiscoverGraphItem;

export interface DiscoverCardGroups {
  topics: DiscoverTopicCard[];
  stories: DiscoverStoryCard[];
  forYou: DiscoverRowCard[];
  comingUp: DiscoverRowCard[];
  reads: DiscoverRowCard[];
  watching: DiscoverRowCard[];
}

export function isDiscoverGraphItem(item: DiscoverItem): item is DiscoverGraphItem {
  return item.type === "story" || item.type === "entity" || item.type === "angles";
}

export function discoverItemKey(item: DiscoverItem): string {
  switch (item.type) {
    case "media":
      return `media:${item.media}`;
    case "card":
      return `card:${item.card.id}`;
    case "story":
      return `story:${item.storyId}`;
    case "entity":
      return `entity:${item.entityId}`;
    case "angles":
      return "angles";
  }
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
): DiscoverEditionItem[] {
  return [
    ...media.map((entry): DiscoverEditionItem => ({ type: "media", media: entry })),
    ...[
      ...groups.topics,
      ...groups.forYou,
      ...groups.comingUp,
      ...groups.watching,
      ...groups.reads,
    ].map((card): DiscoverEditionItem => ({ type: "card", card })),
  ];
}

export function stepDiscoverItem(
  items: readonly DiscoverEditionItem[],
  current: DiscoverItem | null,
  direction: 1 | -1,
): DiscoverEditionItem | null {
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
  if (isDiscoverGraphItem(item)) {
    return null;
  }

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
