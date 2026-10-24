import {
  DISCOVER_EDITION_VERSION,
  type ComposeDiscoverEditionInput,
  type DiscoverCard,
  type DiscoverCardDraft,
  type DiscoverEditionContent,
} from "@ngriffin_uk/polychat-schemas";
import { comparableHttpUrl, normaliseComparableText } from "@ngriffin_uk/polychat-utility-core";

export interface BuildDiscoverEditionInput {
  draft: ComposeDiscoverEditionInput;
  date: string;
  timezone: string;
  generatedAt: string;
  hiddenTopics: ReadonlySet<string>;
  followedTopics: ReadonlySet<string>;
  curate: string;
  resurfaceHrefs: ReadonlySet<string>;
  recentUrls: ReadonlySet<string>;
  createId: () => string;
}

export function discoverTopicKey(topic: string): string {
  return normaliseComparableText(topic);
}

export function discoverEditionGroupId(date: string): string {
  return `discover:${date}`;
}

function cardTopic(card: DiscoverCardDraft): string | null {
  return card.kind === "topic" || card.kind === "read" ? card.topic : null;
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
  const seenUrls = new Set(input.recentUrls);
  const cards: DiscoverCard[] = [];

  for (const card of input.draft.cards) {
    if (isHidden(cardTopic(card), input.hiddenTopics) || isWithheld(card, cardTopic(card), input)) {
      continue;
    }

    if (card.kind === "resurface" && !input.resurfaceHrefs.has(card.href)) {
      continue;
    }

    if (card.kind === "read") {
      const url = comparableHttpUrl(card.url);

      if (!url || seenUrls.has(url)) {
        continue;
      }

      seenUrls.add(url);
    }

    cards.push({ ...card, id: input.createId() });
  }

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

export function listEditionUrls(editions: readonly DiscoverEditionContent[]): Set<string> {
  const urls = new Set<string>();

  for (const edition of editions) {
    for (const card of edition.cards) {
      const url = card.kind === "read" ? comparableHttpUrl(card.url) : null;

      if (url) {
        urls.add(url);
      }
    }
  }

  return urls;
}

export function describeDiscoverCard(card: DiscoverCard): string {
  return card.kind === "check_in" ? card.question : card.title;
}

export function discoverCardTopic(card: DiscoverCard): string | null {
  return card.kind === "topic" || card.kind === "read" ? card.topic : null;
}
