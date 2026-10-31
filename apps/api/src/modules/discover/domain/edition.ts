import {
  DISCOVER_EDITION_VERSION,
  DISCOVER_MAX_EDITION_CARDS,
  type ComposeDiscoverEditionInput,
  type DiscoverCard,
  type DiscoverCardDraft,
  type DiscoverEditionContent,
  type DiscoverEditionTime,
} from "@ngriffin_uk/polychat-schemas";
import { normaliseComparableText } from "@ngriffin_uk/polychat-utility-core";

import { fillDiscoverFeed, type DiscoverFeedGroup } from "./feed";
import { claimUnseenLink, collectSeenLinks, type DiscoverLink } from "./links";

export interface BuildDiscoverEditionInput {
  draft: ComposeDiscoverEditionInput;
  date: string;
  timezone: string;
  generatedAt: string;
  hiddenTopics: ReadonlySet<string>;
  followedTopics: ReadonlySet<string>;
  curate: string;
  resurfaceHrefs: ReadonlySet<string>;
  seenLinks: readonly DiscoverLink[];
  feed: readonly DiscoverFeedGroup[];
  createId: () => string;
}

export function discoverTopicKey(topic: string): string {
  return normaliseComparableText(topic);
}

export function discoverEditionGroupId(
  date: string,
  edition: DiscoverEditionTime = "morning",
): string {
  return edition === "evening" ? `discover:${date}:evening` : `discover:${date}`;
}

export function readDiscoverEditionGroupId(
  groupId: string,
): { date: string; edition: DiscoverEditionTime } | null {
  const match = /^discover:(\d{4}-\d{2}-\d{2})(:evening)?$/u.exec(groupId);

  return match?.[1] ? { date: match[1], edition: match[2] ? "evening" : "morning" } : null;
}

export function discoverEditionTimeAt(hour: number): DiscoverEditionTime {
  return hour >= 15 ? "evening" : "morning";
}

export function carriedDiscoverMedia(
  previous: DiscoverEditionContent | undefined,
  morning: DiscoverEditionContent | undefined,
): Pick<DiscoverEditionContent, "episodeId" | "listenSourceId" | "weekSourceId"> {
  return {
    episodeId: previous?.episodeId ?? morning?.episodeId,
    listenSourceId: morning ? (previous?.listenSourceId ?? morning.listenSourceId) : undefined,
    weekSourceId: previous?.weekSourceId ?? morning?.weekSourceId,
  };
}

function cardTopic(card: DiscoverCardDraft): string | null {
  return "topic" in card ? card.topic : null;
}

export function discoverCardUrl(card: DiscoverCardDraft): string | null {
  return "url" in card && typeof card.url === "string" ? card.url : null;
}

function discoverCardLink(card: DiscoverCardDraft): DiscoverLink | null {
  const url = discoverCardUrl(card);

  return url ? { url, title: "title" in card ? card.title : "" } : null;
}

function isHidden(topic: string | null, hiddenTopics: ReadonlySet<string>): boolean {
  return topic !== null && hiddenTopics.has(discoverTopicKey(topic));
}

function wasAskedFor(topic: string | null, input: BuildDiscoverEditionInput): boolean {
  if (topic === null) {
    return false;
  }

  const key = discoverTopicKey(topic);

  return input.followedTopics.has(key) || normaliseComparableText(input.curate).includes(key);
}

function isWithheld(
  item: { sensitive: boolean },
  topic: string | null,
  input: BuildDiscoverEditionInput,
): boolean {
  return item.sensitive && !wasAskedFor(topic, input);
}

export function buildDiscoverEdition(input: BuildDiscoverEditionInput): DiscoverEditionContent {
  const seen = collectSeenLinks(input.seenLinks);
  const cards: DiscoverCard[] = [];

  for (const card of input.draft.cards) {
    if (isHidden(cardTopic(card), input.hiddenTopics) || isWithheld(card, cardTopic(card), input)) {
      continue;
    }

    if (card.kind === "resurface" && !input.resurfaceHrefs.has(card.href)) {
      continue;
    }

    const link = discoverCardLink(card);

    if (link && !claimUnseenLink(seen, link)) {
      continue;
    }

    cards.push({ ...card, id: input.createId() });
  }

  const withheldTopics = new Set(
    input.draft.interests
      .filter((interest) => isWithheld(interest, interest.topic, input))
      .map((interest) => discoverTopicKey(interest.topic)),
  );

  cards.push(
    ...fillDiscoverFeed({
      groups: input.feed,
      seen,
      skipTopics: new Set([...input.hiddenTopics, ...withheldTopics]),
      limit: DISCOVER_MAX_EDITION_CARDS - cards.length,
      createId: input.createId,
    }),
  );

  return {
    version: DISCOVER_EDITION_VERSION,
    date: input.date,
    timezone: input.timezone,
    greeting: input.draft.greeting,
    interests: input.draft.interests.filter(
      (interest) =>
        !isHidden(interest.topic, input.hiddenTopics) &&
        !isWithheld(interest, interest.topic, input),
    ),
    brief: input.draft.brief,
    cards,
    generatedAt: input.generatedAt,
  };
}

export function listEditionLinks(editions: readonly DiscoverEditionContent[]): DiscoverLink[] {
  return editions.flatMap((edition) =>
    edition.cards.flatMap((card) => {
      const link = discoverCardLink(card);

      return link ? [link] : [];
    }),
  );
}

export function describeDiscoverCard(card: DiscoverCard): string {
  return card.kind === "check_in" ? card.question : card.title;
}

export function findDiscoverCard<TKind extends DiscoverCard["kind"]>(
  cards: readonly DiscoverCard[],
  cardId: string,
  kind: TKind,
): Extract<DiscoverCard, { kind: TKind }> | null {
  return (
    cards.find(
      (card): card is Extract<DiscoverCard, { kind: TKind }> =>
        card.id === cardId && card.kind === kind,
    ) ?? null
  );
}

export function discoverCardTopic(card: DiscoverCard): string | null {
  return "topic" in card ? card.topic : null;
}
